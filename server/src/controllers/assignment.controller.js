import { z } from "zod";
import { prisma } from "../config/database.js";
import { createNotification } from "../services/notification.service.js";

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

const assignmentSchema = z.object({
  assigneeId: z.string().uuid("A valid support staff ID is required"),
  note: z.string().trim().max(1000).optional(),
});

const uuidSchema = z.string().uuid("A valid ID is required");

const validateUuidParam = (value, res) => {
  const result = uuidSchema.safeParse(value);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });

    return false;
  }

  return true;
};

const assignmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

// --------------------------------------------------
// SELECT
// --------------------------------------------------

const assignmentSelect = {
  id: true,
  requestId: true,
  assigneeId: true,
  assignedById: true,
  note: true,
  isActive: true,
  assignedAt: true,
  unassignedAt: true,
  createdAt: true,
  updatedAt: true,

  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
    },
  },

  assignedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

// --------------------------------------------------
// AUTHORIZATION
// --------------------------------------------------

const canManageRequest = (user, request) => {
  if (user.role === "ADMIN") {
    return true;
  }

  return (
    user.role === "SUPPORT_STAFF" &&
    Boolean(user.departmentId) &&
    user.departmentId === request.departmentId
  );
};

// --------------------------------------------------
// ASSIGNEE VALIDATION
// --------------------------------------------------

const validateAssignee = async (tx, assigneeId, departmentId) => {
  const assignee = await tx.user.findUnique({
    where: {
      id: assigneeId,
    },

    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
    },
  });

  if (!assignee) {
    return {
      error: "Support staff member not found",
      status: 404,
    };
  }

  if (assignee.role !== "SUPPORT_STAFF") {
    return {
      error: "Only support staff members can be assigned",
      status: 400,
    };
  }

  if (assignee.status !== "ACTIVE") {
    return {
      error: "Cannot assign a request to inactive support staff",
      status: 400,
    };
  }

  if (assignee.departmentId !== departmentId) {
    return {
      error: "Support staff must belong to the request department",
      status: 400,
    };
  }

  return {
    assignee,
  };
};

// --------------------------------------------------
// ACTIVITY LOG + NOTIFICATION
// --------------------------------------------------

const createAssignmentRecords = async (
  tx,
  { request, assignment, actorId, action, previousAssigneeId = null },
) => {
  await tx.activityLog.create({
    data: {
      action,
      actorId,
      requestId: request.id,

      details: {
        requestCode: request.requestCode,
        previousAssigneeId,
        newAssigneeId: assignment.assigneeId,
        assignmentId: assignment.id,
      },
    },
  });

  await createNotification(
    {
      title: "Request Assigned",
      message: `Request ${request.requestCode} has been assigned to you.`,
      type: "REQUEST_ASSIGNED",
      userId: assignment.assigneeId,
      requestId: request.id,
    },
    tx,
  );
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const isFinalStatus = (status) =>
  ["RESOLVED", "CLOSED", "REJECTED"].includes(status);

const handleAssignmentError = (error, res, action) => {
  console.error(`${action} error:`, error);

  if (error.code === "P2002") {
    return res.status(409).json({
      success: false,
      message:
        "This request already has an active assignment. Refresh and try again.",
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "The requested record was not found",
    });
  }

  return res.status(500).json({
    success: false,
    message: `${action} failed`,
  });
};

// --------------------------------------------------
// ASSIGN REQUEST
// POST /api/v1/assignments/requests/:requestId
// --------------------------------------------------

export const assignRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    if (!validateUuidParam(requestId, res)) {
      return;
    }

    const validation = assignmentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { assigneeId, note } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.findUnique({
        where: {
          id: requestId,
        },

        select: {
          id: true,
          requestCode: true,
          status: true,
          departmentId: true,
        },
      });

      if (!request) {
        return {
          error: "Service request not found",
          status: 404,
        };
      }

      if (!canManageRequest(req.user, request)) {
        return {
          error: "You are not allowed to assign this request",
          status: 403,
        };
      }

      if (isFinalStatus(request.status)) {
        return {
          error: "Cannot assign a resolved, closed, or rejected request",
          status: 400,
        };
      }

      const assigneeResult = await validateAssignee(
        tx,
        assigneeId,
        request.departmentId,
      );

      if (assigneeResult.error) {
        return assigneeResult;
      }

      const activeAssignment = await tx.assignment.findFirst({
        where: {
          requestId,
          isActive: true,
        },
      });

      if (activeAssignment?.assigneeId === assigneeId) {
        return {
          error: "This support staff member is already assigned",
          status: 409,
        };
      }

      // Preserve previous assignment history.
      if (activeAssignment) {
        await tx.assignment.update({
          where: {
            id: activeAssignment.id,
          },

          data: {
            isActive: false,
            unassignedAt: new Date(),
          },
        });
      }

      const assignment = await tx.assignment.create({
        data: {
          requestId,
          assigneeId,
          assignedById: req.user.id,
          note,
        },

        select: assignmentSelect,
      });

      // Change OPEN to ASSIGNED only.
      if (request.status === "OPEN") {
        await tx.serviceRequest.update({
          where: {
            id: requestId,
          },

          data: {
            status: "ASSIGNED",
          },
        });
      }

      await createAssignmentRecords(tx, {
        request,
        assignment,
        actorId: req.user.id,
        action: activeAssignment ? "REQUEST_REASSIGNED" : "REQUEST_ASSIGNED",
        previousAssigneeId: activeAssignment?.assigneeId ?? null,
      });

      return {
        assignment,
      };
    });

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Request assigned successfully",
      data: result.assignment,
    });
  } catch (error) {
    return handleAssignmentError(error, res, "Assign request");
  }
};

// --------------------------------------------------
// REASSIGN REQUEST
// PATCH /api/v1/assignments/:assignmentId/reassign
// --------------------------------------------------

export const reassignRequest = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    if (!validateUuidParam(assignmentId, res)) {
      return;
    }

    const validation = assignmentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { assigneeId, note } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const oldAssignment = await tx.assignment.findUnique({
        where: {
          id: assignmentId,
        },

        include: {
          request: {
            select: {
              id: true,
              requestCode: true,
              status: true,
              departmentId: true,
            },
          },
        },
      });

      if (!oldAssignment) {
        return {
          error: "Assignment not found",
          status: 404,
        };
      }

      if (!oldAssignment.isActive) {
        return {
          error: "This assignment is no longer active",
          status: 400,
        };
      }

      const request = oldAssignment.request;

      if (!canManageRequest(req.user, request)) {
        return {
          error: "You are not allowed to reassign this request",
          status: 403,
        };
      }

      if (isFinalStatus(request.status)) {
        return {
          error: "Cannot reassign a completed or rejected request",
          status: 400,
        };
      }

      const assigneeResult = await validateAssignee(
        tx,
        assigneeId,
        request.departmentId,
      );

      if (assigneeResult.error) {
        return assigneeResult;
      }

      if (oldAssignment.assigneeId === assigneeId) {
        return {
          error: "Request is already assigned to this staff member",
          status: 409,
        };
      }

      await tx.assignment.update({
        where: {
          id: assignmentId,
        },

        data: {
          isActive: false,
          unassignedAt: new Date(),
        },
      });

      const assignment = await tx.assignment.create({
        data: {
          requestId: request.id,
          assigneeId,
          assignedById: req.user.id,
          note,
        },

        select: assignmentSelect,
      });

      if (request.status === "OPEN") {
        await tx.serviceRequest.update({
          where: {
            id: request.id,
          },

          data: {
            status: "ASSIGNED",
          },
        });
      }

      await createAssignmentRecords(tx, {
        request,
        assignment,
        actorId: req.user.id,
        action: "REQUEST_REASSIGNED",
        previousAssigneeId: oldAssignment.assigneeId,
      });

      return {
        assignment,
      };
    });

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Request reassigned successfully",
      data: result.assignment,
    });
  } catch (error) {
    return handleAssignmentError(error, res, "Reassign request");
  }
};

// --------------------------------------------------
// GET REQUEST ASSIGNMENT HISTORY
// GET /api/v1/assignments/requests/:requestId
// --------------------------------------------------

export const getRequestAssignmentHistory = async (req, res) => {
  try {
    const { requestId } = req.params;

    if (!validateUuidParam(requestId, res)) {
      return;
    }

    const request = await prisma.serviceRequest.findUnique({
      where: {
        id: requestId,
      },

      select: {
        id: true,
        requestCode: true,
        requesterId: true,
        departmentId: true,
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    const isRequester =
      req.user.role === "EMPLOYEE" && req.user.id === request.requesterId;

    if (!isRequester && !canManageRequest(req.user, request)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this assignment history",
      });
    }

    const assignments = await prisma.assignment.findMany({
      where: {
        requestId,
      },

      select: assignmentSelect,

      orderBy: {
        assignedAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    });
  } catch (error) {
    console.error("Assignment history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assignment history",
    });
  }
};

// --------------------------------------------------
// GET ASSIGNMENT BY ID
// GET /api/v1/assignments/:assignmentId
// --------------------------------------------------

export const getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    if (!validateUuidParam(assignmentId, res)) {
      return;
    }

    const assignment = await prisma.assignment.findUnique({
      where: {
        id: assignmentId,
      },

      select: {
        ...assignmentSelect,

        request: {
          select: {
            id: true,
            requestCode: true,
            title: true,
            status: true,
            departmentId: true,
            requesterId: true,
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    const isRequester =
      req.user.role === "EMPLOYEE" &&
      req.user.id === assignment.request.requesterId;

    const isAssignee = req.user.id === assignment.assigneeId;

    if (
      req.user.role !== "ADMIN" &&
      !isRequester &&
      !isAssignee &&
      !canManageRequest(req.user, assignment.request)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this assignment",
      });
    }

    return res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error("Get assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assignment",
    });
  }
};

/**
 * GET /api/v1/assignments
 *
 * ADMIN:
 *   View all assignments.
 *
 * SUPPORT_STAFF:
 *   View assignments belonging to their department.
 *
 * EMPLOYEE:
 *   View assignments belonging to their own requests.
 */
export const getAllAssignments = async (req, res) => {
  try {
    const validation = assignmentListQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { page, limit, search, isActive } = validation.data;
    const skip = (page - 1) * limit;

    // Apply access restrictions based on the logged-in user.
    let accessFilter = {};

    if (req.user.role === "SUPPORT_STAFF") {
      if (!req.user.departmentId) {
        return res.status(200).json({
          success: true,
          message: "No assignments found",
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }

      accessFilter = {
        request: {
          is: {
            departmentId: req.user.departmentId,
          },
        },
      };
    } else if (req.user.role === "EMPLOYEE") {
      accessFilter = {
        request: {
          is: {
            requesterId: req.user.id,
          },
        },
      };
    } else if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view assignments",
      });
    }

    // Apply optional active/history filter.
    const activeFilter =
      isActive !== undefined ? { isActive: isActive === "true" } : {};

    // Search request details and staff information.
    const searchFilter = search
      ? {
          OR: [
            {
              request: {
                is: {
                  requestCode: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              request: {
                is: {
                  title: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              assignee: {
                is: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              assignee: {
                is: {
                  email: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              assignedBy: {
                is: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {};

    const where = {
      AND: [accessFilter, activeFilter, searchFilter],
    };

    const [assignments, total, activeCount, previousCount] = await Promise.all([
      prisma.assignment.findMany({
        where,
        select: {
          ...assignmentSelect,
          request: {
            select: {
              id: true,
              requestCode: true,
              title: true,
              status: true,
              priority: true,
              departmentId: true,
              requesterId: true,
            },
          },
        },
        orderBy: {
          assignedAt: "desc",
        },
        skip,
        take: limit,
      }),

      prisma.assignment.count({ where }),

      prisma.assignment.count({
        where: {
          AND: [accessFilter, { isActive: true }],
        },
      }),

      prisma.assignment.count({
        where: {
          AND: [accessFilter, { isActive: false }],
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Assignments retrieved successfully",
      data: assignments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        activeCount,
        previousCount,
      },
    });
  } catch (error) {
    console.error("Get all assignments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assignments",
    });
  }
};
