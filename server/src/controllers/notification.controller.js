import { z } from "zod";
import { prisma } from "../config/database.js";

const notificationTypes = [
  "REQUEST_CREATED",
  "REQUEST_ASSIGNED",
  "STATUS_CHANGED",
  "NEW_COMMENT",
  "SLA_WARNING",
  "SLA_BREACHED",
];

const notificationIdSchema = z
  .string()
  .uuid("A valid notification ID is required");

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  isRead: z.enum(["true", "false"]).optional(),
  type: z.enum(notificationTypes).optional(),
});

const notificationSelect = {
  id: true,
  title: true,
  message: true,
  type: true,
  isRead: true,
  userId: true,
  requestId: true,
  createdAt: true,
  request: {
    select: {
      id: true,
      requestCode: true,
      title: true,
      status: true,
    },
  },
};

// GET /api/v1/notifications
export const getMyNotifications = async (req, res) => {
  try {
    const validation = querySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { page, limit, isRead, type } = validation.data;
    const skip = (page - 1) * limit;

    const where = {
      userId: req.user.id,
      ...(isRead !== undefined && {
        isRead: isRead === "true",
      }),
      ...(type && { type }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),

      prisma.notification.count({ where }),

      prisma.notification.count({
        where: {
          userId: req.user.id,
          isRead: false,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

// GET /api/v1/notifications/unread-count
export const getUnreadNotificationCount = async (req, res) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Unread notification count error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread notification count",
    });
  }
};

// PATCH /api/v1/notifications/:notificationId/read
export const markNotificationAsRead = async (req, res) => {
  try {
    const idValidation = notificationIdSchema.safeParse(
      req.params.notificationId,
    );

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const result = await prisma.notification.updateMany({
      where: {
        id: idValidation.data,
        userId: req.user.id,
      },
      data: {
        isRead: true,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: idValidation.data,
        userId: req.user.id,
      },
      select: notificationSelect,
    });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

// PATCH /api/v1/notifications/read-all
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};

// DELETE /api/v1/notifications/:notificationId
export const deleteNotification = async (req, res) => {
  try {
    const idValidation = notificationIdSchema.safeParse(
      req.params.notificationId,
    );

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const result = await prisma.notification.deleteMany({
      where: {
        id: idValidation.data,
        userId: req.user.id,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};
