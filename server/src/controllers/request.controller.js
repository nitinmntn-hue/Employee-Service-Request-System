import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../config/database.js";
import {
  getApplicableSla,
  calculateSlaDeadlines,
} from "../services/sla.service.js";
import { notifyDepartmentSupportStaff } from "../services/notification.service.js";

// Request status values from Prisma schema
const REQUEST_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
];

const REQUEST_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// Validation schemas
const createRequestSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(5000),
  categoryId: z.string().min(1),
  priority: z.enum(REQUEST_PRIORITIES).default("MEDIUM"),
});

const updateRequestSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  categoryId: z.string().min(1).optional(),
  priority: z.enum(REQUEST_PRIORITIES).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(REQUEST_STATUSES),
});

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Fields returned in request API responses
const requestSelect = {
  id: true,
  requestCode: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  requesterId: true,
  departmentId: true,
  categoryId: true,
  slaId: true,
  responseDueAt: true,
  resolutionDueAt: true,
  resolvedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,

  requester: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },

  department: {
    select: {
      id: true,
      name: true,
    },
  },

  category: {
    select: {
      id: true,
      name: true,
    },
  },

  assignments: {
    select: {
      id: true,
      assigneeId: true,
      assignedById: true,
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  },

  _count: {
    select: {
      comments: true,
      attachments: true,
    },
  },
};

// Generate a readable unique request number
const generateRequestCode = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  const random = randomBytes(3).toString("hex").toUpperCase();

  return `SR-${date}-${random}`;
};

// Determine which requests a user is allowed to see
const getRequestAccessFilter = (user) => {
  if (user.role === "ADMIN") {
    return {};
  }

  if (user.role === "EMPLOYEE") {
    return {
      requesterId: user.id,
    };
  }

  if (user.role === "SUPPORT_STAFF") {
    if (user.departmentId) {
      return {
        departmentId: user.departmentId,
      };
    }

    // Support staff without a department can see their assignments only
    return {
      assignments: {
        some: {
          assigneeId: user.id,
        },
      },
    };
  }

  return {
    id: "NO_ACCESS",
  };
};

// Check access to an individual request
const canAccessRequest = (request, user) => {
  if (user.role === "ADMIN") {
    return true;
  }

  if (user.role === "EMPLOYEE") {
    return request.requesterId === user.id;
  }

  if (user.role === "SUPPORT_STAFF") {
    const belongsToDepartment =
      user.departmentId && request.departmentId === user.departmentId;

    const isAssigned = request.assignments?.some(
      (assignment) => assignment.assigneeId === user.id,
    );

    return Boolean(belongsToDepartment || isAssigned);
  }

  return false;
};

// GET /api/v1/requests
export const getAllRequests = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();

    const allowedStatuses = REQUEST_STATUSES;
    const allowedPriorities = REQUEST_PRIORITIES;

    if (
      req.query.status &&
      !allowedStatuses.includes(String(req.query.status))
    ) {
      return next(createError("Invalid request status"));
    }

    if (
      req.query.priority &&
      !allowedPriorities.includes(String(req.query.priority))
    ) {
      return next(createError("Invalid request priority"));
    }

    const accessFilter = getRequestAccessFilter(req.user);

    const where = {
      ...accessFilter,

      ...(req.query.status && {
        status: String(req.query.status),
      }),

      ...(req.query.priority && {
        priority: String(req.query.priority),
      }),

      ...(req.query.categoryId && {
        categoryId: String(req.query.categoryId),
      }),

      ...(req.query.departmentId && {
        departmentId: String(req.query.departmentId),
      }),

      ...(search && {
        OR: [
          {
            requestCode: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      }),
    };

    const [requests, totalRequests] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        select: requestSelect,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.serviceRequest.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Service requests retrieved successfully",
      data: requests,
      pagination: {
        currentPage: page,
        limit,
        totalRequests,
        totalPages: Math.ceil(totalRequests / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/requests/:id
export const getRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await prisma.serviceRequest.findUnique({
      where: { id },
      select: requestSelect,
    });

    if (!request) {
      return next(createError("Service request not found", 404));
    }

    if (!canAccessRequest(request, req.user)) {
      return next(
        createError("You do not have permission to view this request", 403),
      );
    }

    return res.status(200).json({
      success: true,
      message: "Service request retrieved successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/requests

export const createRequest = async (req, res, next) => {
  try {
    const validation = createRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues,
      });
    }

    const { title, description, categoryId, priority } = validation.data;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        department: true,
      },
    });

    if (!category) {
      return next(createError("Category not found", 404));
    }

    if (!category.isActive) {
      return next(createError("This category is inactive", 400));
    }

    if (!category.department?.isActive) {
      return next(createError("This department is inactive", 400));
    }

    const departmentId = category.departmentId;

    // Employees can submit requests only to their own department
    // when they have a department assigned.
    if (
      req.user.role === "EMPLOYEE" &&
      req.user.departmentId &&
      req.user.departmentId !== departmentId
    ) {
      return next(
        createError("You can only submit requests to your department", 403),
      );
    }

    // Find applicable department-specific or global SLA.
    const sla = await getApplicableSla(priority, departmentId);
    const deadlines = calculateSlaDeadlines(sla);

    const request = await prisma.$transaction(async (tx) => {
      const createdRequest = await tx.serviceRequest.create({
        data: {
          requestCode: generateRequestCode(),
          title,
          description,
          priority,
          requesterId: req.user.id,
          departmentId,
          categoryId,
          slaId: sla.id,
          responseDueAt: deadlines.responseDueAt,
          resolutionDueAt: deadlines.resolutionDueAt,
        },
        select: requestSelect,
      });

      // Record request creation.
      await tx.activityLog.create({
        data: {
          action: "REQUEST_CREATED",
          actorId: req.user.id,
          requestId: createdRequest.id,
          details: {
            requestCode: createdRequest.requestCode,
            priority,
          },
        },
      });

      // Notify active support staff in the request department.
      await notifyDepartmentSupportStaff(
        departmentId,
        {
          title: "New Service Request",
          message: `A new request ${createdRequest.requestCode} has been submitted.`,
          type: "REQUEST_CREATED",
        },
        [req.user.id],
        tx,
      );

      return createdRequest;
    });

    return res.status(201).json({
      success: true,
      message: "Service request created successfully",
      data: request,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(createError("Request code conflict. Please try again.", 409));
    }

    next(error);
  }
};

// PATCH /api/v1/requests/:id
// Employees can edit their own OPEN requests.
// Admins can edit any request.
export const updateRequest = async (req, res, next) => {
  try {
    const validation = updateRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues,
      });
    }

    const { id } = req.params;
    const updateData = validation.data;

    if (Object.keys(updateData).length === 0) {
      return next(createError("Provide at least one field to update"));
    }

    const existingRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        assignments: true,
      },
    });

    if (!existingRequest) {
      return next(createError("Service request not found", 404));
    }

    if (req.user.role === "EMPLOYEE") {
      if (existingRequest.requesterId !== req.user.id) {
        return next(
          createError("You cannot edit another employee's request", 403),
        );
      }

      if (existingRequest.status !== "OPEN") {
        return next(
          createError("Only OPEN requests can be edited by employees", 400),
        );
      }
    } else if (req.user.role !== "ADMIN") {
      return next(createError("You cannot edit this request", 403));
    }

    if (updateData.categoryId) {
      const category = await prisma.category.findUnique({
        where: {
          id: updateData.categoryId,
        },
        include: {
          department: true,
        },
      });

      if (!category) {
        return next(createError("Category not found", 404));
      }

      if (!category.isActive || !category.department.isActive) {
        return next(
          createError("Selected category or department is inactive", 400),
        );
      }

      updateData.departmentId = category.departmentId;
    }

    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: updateData,
      select: requestSelect,
    });

    return res.status(200).json({
      success: true,
      message: "Service request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    next(error);
  }
};

// Allowed request status transitions
const STATUS_TRANSITIONS = {
  OPEN: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "REJECTED"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED", "REJECTED"],
  ON_HOLD: ["IN_PROGRESS", "REJECTED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  REJECTED: [],
};

// PATCH /api/v1/requests/:id/status

export const updateRequestStatus = async (req, res, next) => {
  try {
    const validation = updateStatusSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request status",
        errors: validation.error.issues,
      });
    }

    const { id } = req.params;
    const { status } = validation.data;

    if (!["ADMIN", "SUPPORT_STAFF"].includes(req.user.role)) {
      return next(
        createError("You are not allowed to change request status", 403),
      );
    }

    const existingRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        assignments: true,
      },
    });

    if (!existingRequest) {
      return next(createError("Service request not found", 404));
    }

    if (!canAccessRequest(existingRequest, req.user)) {
      return next(
        createError("You do not have permission to update this request", 403),
      );
    }

    if (existingRequest.status === status) {
      return next(createError("Request already has this status"));
    }

    const allowedTransitions = STATUS_TRANSITIONS[existingRequest.status] || [];

    if (!allowedTransitions.includes(status)) {
      return next(
        createError(
          `Cannot change request status from ${existingRequest.status} to ${status}`,
          400,
        ),
      );
    }

    const updateData = { status };

    if (status === "RESOLVED") {
      updateData.resolvedAt = new Date();
    }

    if (status === "CLOSED") {
      updateData.closedAt = new Date();
    }

    if (status === "IN_PROGRESS" && existingRequest.status === "RESOLVED") {
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceRequest.update({
        where: { id },
        data: updateData,
        select: requestSelect,
      });

      // Save status change in activity history.
      await tx.activityLog.create({
        data: {
          action: "REQUEST_STATUS_CHANGED",
          actorId: req.user.id,
          requestId: id,
          details: {
            previousStatus: existingRequest.status,
            newStatus: status,
          },
        },
      });

      const notification = {
        title: "Request Status Updated",
        message: `Your request ${existingRequest.requestCode} is now ${status}.`,
        type: "STATUS_CHANGED",
      };

      // Notify requester.
      await notifyRequester(existingRequest, notification, tx);

      // Notify active assignees, excluding the person making the change
      // and requester (already notified separately).
      await notifyActiveAssignees(
        id,
        {
          title: "Assigned Request Status Updated",
          message: `Request ${existingRequest.requestCode} is now ${status}.`,
          type: "STATUS_CHANGED",
        },
        [req.user.id, existingRequest.requesterId],
        tx,
      );

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: `Request status changed to ${status}`,
      data: updatedRequest,
    });
  } catch (error) {
    next(error);
  }
};
