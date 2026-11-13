import { z } from "zod";
import { prisma } from "../config/database.js";

import {
  getActivityLogs,
  getRequestActivityLogs,
  getActivityLogById,
} from "../services/activityLog.service.js";

const uuidSchema = z.string().uuid();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  action: z.string().trim().optional(),
  actorId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),

  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * Check whether a user can access a request's activity logs.
 */
const canAccessRequest = async (user, request) => {
  if (user.role === "ADMIN") {
    return true;
  }

  if (user.role === "EMPLOYEE" && request.requesterId === user.id) {
    return true;
  }

  if (user.role === "SUPPORT_STAFF") {
    if (request.departmentId === user.departmentId) {
      return true;
    }

    const assignment = await prisma.assignment.findFirst({
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

/**
 * GET /api/v1/activity-logs
 * ADMIN only.
 */
export const getAllActivityLogs = async (req, res) => {
  try {
    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters.",
        errors: parsed.error.flatten(),
      });
    }

    const result = await getActivityLogs(parsed.data);

    return res.status(200).json({
      success: true,
      message: "Activity logs fetched successfully.",
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get activity logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity logs.",
    });
  }
};

/**
 * GET /api/v1/activity-logs/requests/:requestId
 * ADMIN, requester, or authorized support staff.
 */
export const getRequestLogs = async (req, res) => {
  try {
    const { requestId } = req.params;

    if (!uuidSchema.safeParse(requestId).success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requesterId: true,
        departmentId: true,
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found.",
      });
    }

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view these activity logs.",
      });
    }

    const parsed = querySchema
      .pick({
        page: true,
        limit: true,
      })
      .safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters.",
        errors: parsed.error.flatten(),
      });
    }

    const result = await getRequestActivityLogs(requestId, parsed.data);

    return res.status(200).json({
      success: true,
      message: "Request activity logs fetched successfully.",
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get request activity logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch request activity logs.",
    });
  }
};

/**
 * GET /api/v1/activity-logs/:activityLogId
 * ADMIN or a user who can access the associated request.
 */
export const getActivityLog = async (req, res) => {
  try {
    const { activityLogId } = req.params;

    if (!uuidSchema.safeParse(activityLogId).success) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity log ID.",
      });
    }

    const activityLog = await getActivityLogById(activityLogId);

    if (!activityLog) {
      return res.status(404).json({
        success: false,
        message: "Activity log not found.",
      });
    }

    if (req.user.role !== "ADMIN") {
      if (!activityLog.request) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to view this activity log.",
        });
      }

      const request = await prisma.serviceRequest.findUnique({
        where: {
          id: activityLog.request.id,
        },
        select: {
          id: true,
          requesterId: true,
          departmentId: true,
        },
      });

      const hasAccess = request && (await canAccessRequest(req.user, request));

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to view this activity log.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Activity log fetched successfully.",
      data: activityLog,
    });
  } catch (error) {
    console.error("Get activity log error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity log.",
    });
  }
};
