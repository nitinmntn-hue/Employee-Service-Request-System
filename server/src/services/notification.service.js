import { prisma } from "../config/database.js";

const NOTIFICATION_TYPES = [
  "REQUEST_CREATED",
  "REQUEST_ASSIGNED",
  "STATUS_CHANGED",
  "NEW_COMMENT",
  "SLA_WARNING",
  "SLA_BREACHED",
];

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Validate notification data.
const validateNotification = (data) => {
  if (!data.title?.trim()) {
    throw createError("Notification title is required.");
  }

  if (!data.message?.trim()) {
    throw createError("Notification message is required.");
  }

  if (!NOTIFICATION_TYPES.includes(data.type)) {
    throw createError("Invalid notification type.");
  }

  if (!data.userId) {
    throw createError("Notification recipient is required.");
  }
};

// Create a notification for one user.
// Pass a transaction client when called inside a Prisma transaction.
export const createNotification = async (data, db = prisma) => {
  validateNotification(data);

  return db.notification.create({
    data: {
      title: data.title.trim(),
      message: data.message.trim(),
      type: data.type,
      userId: data.userId,
      requestId: data.requestId ?? null,
    },
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      isRead: true,
      userId: true,
      requestId: true,
      createdAt: true,
    },
  });
};

// Create notifications for multiple users.
export const createBulkNotifications = async (data, db = prisma) => {
  const {
    userIds,
    title,
    message,
    type,
    requestId = null,
    excludeUserIds = [],
  } = data;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { count: 0 };
  }

  validateNotification({
    title,
    message,
    type,
    userId: userIds[0],
  });

  const excluded = new Set(excludeUserIds);

  // Remove duplicate IDs and excluded recipients.
  const uniqueUserIds = [...new Set(userIds)].filter(
    (id) => id && !excluded.has(id),
  );

  if (uniqueUserIds.length === 0) {
    return { count: 0 };
  }

  return db.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      title: title.trim(),
      message: message.trim(),
      type,
      userId,
      requestId,
    })),
    skipDuplicates: true,
  });
};

// Notify the requester.
export const notifyRequester = async (request, notification, db = prisma) => {
  if (!request?.requesterId) {
    return { count: 0 };
  }

  return createNotification(
    {
      ...notification,
      userId: request.requesterId,
      requestId: request.id,
    },
    db,
  );
};

// Notify active assignees of a request.
export const notifyActiveAssignees = async (
  requestId,
  notification,
  excludeUserIds = [],
  db = prisma,
) => {
  const assignments = await db.assignment.findMany({
    where: {
      requestId,
      isActive: true,
    },
    select: {
      assigneeId: true,
    },
  });

  const userIds = assignments.map((assignment) => assignment.assigneeId);

  return createBulkNotifications(
    {
      ...notification,
      userIds,
      requestId,
      excludeUserIds,
    },
    db,
  );
};

// Notify all active support staff in a department.
export const notifyDepartmentSupportStaff = async (
  departmentId,
  notification,
  excludeUserIds = [],
  db = prisma,
) => {
  const users = await db.user.findMany({
    where: {
      departmentId,
      role: "SUPPORT_STAFF",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  return createBulkNotifications(
    {
      ...notification,
      userIds: users.map((user) => user.id),
      excludeUserIds,
    },
    db,
  );
};

// Notify employees/admins/support staff by explicitly supplied IDs.
export const notifyUsers = async (userIds, notification, db = prisma) => {
  return createBulkNotifications(
    {
      ...notification,
      userIds,
    },
    db,
  );
};

export { NOTIFICATION_TYPES };
