import { z } from "zod";
import { prisma } from "../config/database.js";

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

const commentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(5000),

  isInternal: z.boolean().optional().default(false),
});

const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

const uuidSchema = z.string().uuid("A valid UUID is required");

// --------------------------------------------------
// SELECT
// --------------------------------------------------

const commentSelect = {
  id: true,
  content: true,
  isInternal: true,
  requestId: true,
  authorId: true,
  createdAt: true,

  author: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

// --------------------------------------------------
// REQUEST ACCESS
// --------------------------------------------------

const canAccessRequest = async (user, request, db = prisma) => {
  if (!request) return false;

  if (user.role === "ADMIN") {
    return true;
  }

  if (user.role === "EMPLOYEE" && request.requesterId === user.id) {
    return true;
  }

  if (user.role === "SUPPORT_STAFF") {
    // Support staff can access requests in their department.
    if (user.departmentId && user.departmentId === request.departmentId) {
      return true;
    }

    // Previously assigned staff retain access to the request history.
    const assignment = await db.assignment.findFirst({
      where: {
        requestId: request.id,
        assigneeId: user.id,
      },
      select: {
        id: true,
      },
    });

    return Boolean(assignment);
  }

  return false;
};

// --------------------------------------------------
// GET REQUEST
// --------------------------------------------------

const getRequest = async (requestId, db = prisma) => {
  return db.serviceRequest.findUnique({
    where: {
      id: requestId,
    },

    select: {
      id: true,
      requestCode: true,
      title: true,
      requesterId: true,
      departmentId: true,
    },
  });
};

// --------------------------------------------------
// PAGINATION
// --------------------------------------------------

const getPagination = (query) => {
  const pageValue = Number.parseInt(query.page, 10);
  const limitValue = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(pageValue) ? Math.max(pageValue, 1) : 1;

  const limit = Number.isFinite(limitValue)
    ? Math.min(Math.max(limitValue, 1), 100)
    : 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

// --------------------------------------------------
// GET REQUEST COMMENTS
// GET /api/v1/comments/requests/:requestId
// --------------------------------------------------

export const getRequestComments = async (req, res) => {
  try {
    const idValidation = uuidSchema.safeParse(req.params.requestId);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
    }

    const request = await getRequest(idValidation.data);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view these comments",
      });
    }

    const { page, limit, skip } = getPagination(req.query);

    // Employees must never see internal comments.
    const where = {
      requestId: request.id,

      ...(req.user.role === "EMPLOYEE" && {
        isInternal: false,
      }),
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        select: commentSelect,

        orderBy: {
          createdAt: "asc",
        },

        skip,
        take: limit,
      }),

      prisma.comment.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Comments fetched successfully",
      data: comments,

      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get request comments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
    });
  }
};

// --------------------------------------------------
// CREATE COMMENT
// POST /api/v1/comments/requests/:requestId
// --------------------------------------------------

export const createComment = async (req, res) => {
  try {
    const idValidation = uuidSchema.safeParse(req.params.requestId);
    const validation = commentSchema.safeParse(req.body);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
    }

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { content, isInternal } = validation.data;

    // Employees cannot create internal comments.
    if (isInternal && !["ADMIN", "SUPPORT_STAFF"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Employees cannot create internal comments",
      });
    }

    const request = await getRequest(idValidation.data);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to comment on this request",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create comment.
      const comment = await tx.comment.create({
        data: {
          content,
          isInternal,
          requestId: request.id,
          authorId: req.user.id,
        },

        select: commentSelect,
      });

      // Create activity log.
      await tx.activityLog.create({
        data: {
          action: isInternal ? "INTERNAL_COMMENT_ADDED" : "COMMENT_ADDED",

          actorId: req.user.id,
          requestId: request.id,

          details: {
            commentId: comment.id,
            isInternal,
          },
        },
      });

      // Find active assignees, excluding the comment author.
      const activeAssignments = await tx.assignment.findMany({
        where: {
          requestId: request.id,
          isActive: true,
          assigneeId: {
            not: req.user.id,
          },
        },

        select: {
          assigneeId: true,
        },
      });

      const recipientIds = new Set(
        activeAssignments.map((item) => item.assigneeId),
      );

      // Notify requester only for public comments.
      if (!isInternal && request.requesterId !== req.user.id) {
        recipientIds.add(request.requesterId);
      }

      // Create notifications.
      if (recipientIds.size > 0) {
        await tx.notification.createMany({
          data: [...recipientIds].map((userId) => ({
            title: isInternal
              ? "New internal comment"
              : "New comment on service request",

            message: `A new comment was added to request ${request.requestCode}.`,

            type: "NEW_COMMENT",
            userId,
            requestId: request.id,
          })),
        });
      }

      return comment;
    });

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add comment",
    });
  }
};

// --------------------------------------------------
// GET COMMENT BY ID
// GET /api/v1/comments/:commentId
// --------------------------------------------------

export const getCommentById = async (req, res) => {
  try {
    const idValidation = uuidSchema.safeParse(req.params.commentId);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    const comment = await prisma.comment.findUnique({
      where: {
        id: idValidation.data,
      },

      select: {
        ...commentSelect,

        request: {
          select: {
            id: true,
            requesterId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const hasAccess = await canAccessRequest(req.user, comment.request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this comment",
      });
    }

    if (comment.isInternal && req.user.role === "EMPLOYEE") {
      return res.status(403).json({
        success: false,
        message: "You cannot view internal comments",
      });
    }

    const { request, ...commentData } = comment;

    return res.status(200).json({
      success: true,
      data: commentData,
    });
  } catch (error) {
    console.error("Get comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch comment",
    });
  }
};

// --------------------------------------------------
// UPDATE COMMENT
// PATCH /api/v1/comments/:commentId
// --------------------------------------------------

export const updateComment = async (req, res) => {
  try {
    const idValidation = uuidSchema.safeParse(req.params.commentId);
    const validation = updateCommentSchema.safeParse(req.body);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const comment = await prisma.comment.findUnique({
      where: {
        id: idValidation.data,
      },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const request = await getRequest(comment.requestId);

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to edit this comment",
      });
    }

    // Only author or administrator can edit.
    if (comment.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own comments",
      });
    }

    const updatedComment = await prisma.$transaction(async (tx) => {
      const updated = await tx.comment.update({
        where: {
          id: comment.id,
        },

        data: {
          content: validation.data.content,
        },

        select: commentSelect,
      });

      await tx.activityLog.create({
        data: {
          action: "COMMENT_UPDATED",
          actorId: req.user.id,
          requestId: comment.requestId,

          details: {
            commentId: comment.id,
          },
        },
      });

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: updatedComment,
    });
  } catch (error) {
    console.error("Update comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update comment",
    });
  }
};

// --------------------------------------------------
// DELETE COMMENT
// DELETE /api/v1/comments/:commentId
// --------------------------------------------------

export const deleteComment = async (req, res) => {
  try {
    const idValidation = uuidSchema.safeParse(req.params.commentId);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    const comment = await prisma.comment.findUnique({
      where: {
        id: idValidation.data,
      },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const request = await getRequest(comment.requestId);

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this comment",
      });
    }

    // Only author or administrator can delete.
    if (comment.authorId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.delete({
        where: {
          id: comment.id,
        },
      });

      await tx.activityLog.create({
        data: {
          action: "COMMENT_DELETED",
          actorId: req.user.id,
          requestId: comment.requestId,

          details: {
            commentId: comment.id,
          },
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Delete comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete comment",
    });
  }
};
