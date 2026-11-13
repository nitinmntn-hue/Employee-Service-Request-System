import { prisma } from "../config/database.js";

export const activityLogSelect = {
  id: true,
  action: true,
  details: true,
  actorId: true,
  requestId: true,
  createdAt: true,

  actor: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },

  request: {
    select: {
      id: true,
      requestCode: true,
      title: true,
      status: true,
    },
  },
};

/**
 * Create one activity log.
 *
 * Can receive Prisma client or transaction client.
 */
export const createActivityLog = async (data, db = prisma) => {
  const { action, details, actorId, requestId } = data;

  if (!action || typeof action !== "string") {
    throw new Error("Activity action is required.");
  }

  return db.activityLog.create({
    data: {
      action,
      details: details ?? undefined,
      actorId: actorId ?? null,
      requestId: requestId ?? null,
    },
    select: activityLogSelect,
  });
};

/**
 * Create multiple activity logs.
 */
export const createBulkActivityLogs = async (logs, db = prisma) => {
  if (!Array.isArray(logs) || logs.length === 0) {
    return { count: 0 };
  }

  return db.activityLog.createMany({
    data: logs.map((log) => ({
      action: log.action,
      details: log.details ?? undefined,
      actorId: log.actorId ?? null,
      requestId: log.requestId ?? null,
    })),
  });
};

/**
 * Get activity logs with pagination and filters.
 */
export const getActivityLogs = async (
  { page = 1, limit = 20, action, actorId, requestId, from, to } = {},
  db = prisma,
) => {
  const skip = (page - 1) * limit;

  const where = {
    ...(action && {
      action: {
        contains: action,
        mode: "insensitive",
      },
    }),

    ...(actorId && { actorId }),
    ...(requestId && { requestId }),

    ...((from || to) && {
      createdAt: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    }),
  };

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      select: activityLogSelect,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),

    db.activityLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get activity logs for a specific request.
 */
export const getRequestActivityLogs = async (
  requestId,
  { page = 1, limit = 20 } = {},
  db = prisma,
) => {
  const skip = (page - 1) * limit;

  const where = { requestId };

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      select: activityLogSelect,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),

    db.activityLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get one activity log by ID.
 */
export const getActivityLogById = async (activityLogId, db = prisma) => {
  return db.activityLog.findUnique({
    where: {
      id: activityLogId,
    },
    select: activityLogSelect,
  });
};
