import { prisma } from "../config/database.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const slaSelect = {
  id: true,
  priority: true,
  responseMinutes: true,
  resolutionMinutes: true,
  departmentId: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
};

// Find an SLA by ID.
export const getSlaById = async (id, db = prisma) => {
  const sla = await db.sLA.findUnique({
    where: { id },
    select: slaSelect,
  });

  if (!sla) {
    throw createError("SLA policy not found.", 404);
  }

  return sla;
};

// Get all SLA policies.
export const getAllSlas = async (filters = {}, db = prisma) => {
  const { priority, departmentId, page = 1, limit = 10 } = filters;

  const where = {};

  if (priority) {
    where.priority = priority;
  }

  if (departmentId === "global") {
    where.departmentId = null;
  } else if (departmentId) {
    where.departmentId = departmentId;
  }

  const skip = (page - 1) * limit;

  const [slas, total] = await db.$transaction([
    db.sLA.findMany({
      where,
      select: slaSelect,
      orderBy: [{ priority: "asc" }, { departmentId: "asc" }],
      skip,
      take: limit,
    }),
    db.sLA.count({ where }),
  ]);

  return {
    slas,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Check whether an SLA already exists for the same priority and department.
const ensureUniqueSla = async (
  priority,
  departmentId,
  excludeId,
  db = prisma,
) => {
  const existing = await db.sLA.findFirst({
    where: {
      priority,
      departmentId: departmentId ?? null,
      ...(excludeId && {
        id: { not: excludeId },
      }),
    },
    select: { id: true },
  });

  if (existing) {
    throw createError(
      "An SLA policy already exists for this priority and department.",
      409,
    );
  }
};

// Create an SLA policy.
export const createSla = async (data, db = prisma) => {
  const {
    priority,
    responseMinutes,
    resolutionMinutes,
    departmentId = null,
  } = data;

  if (departmentId) {
    const department = await db.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!department) {
      throw createError("Department not found.", 404);
    }
  }

  await ensureUniqueSla(priority, departmentId, null, db);

  return db.sLA.create({
    data: {
      priority,
      responseMinutes,
      resolutionMinutes,
      departmentId,
    },
    select: slaSelect,
  });
};

// Update an SLA policy.
export const updateSla = async (id, data, db = prisma) => {
  const existing = await db.sLA.findUnique({
    where: { id },
    select: { id: true, priority: true, departmentId: true },
  });

  if (!existing) {
    throw createError("SLA policy not found.", 404);
  }

  const priority = data.priority ?? existing.priority;
  const departmentId =
    data.departmentId === undefined ? existing.departmentId : data.departmentId;

  if (departmentId) {
    const department = await db.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!department) {
      throw createError("Department not found.", 404);
    }
  }

  await ensureUniqueSla(priority, departmentId, id, db);

  return db.sLA.update({
    where: { id },
    data: {
      ...data,
      departmentId,
    },
    select: slaSelect,
  });
};

// Delete an SLA policy.
export const deleteSla = async (id, db = prisma) => {
  const existing = await db.sLA.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw createError("SLA policy not found.", 404);
  }

  const linkedRequests = await db.serviceRequest.count({
    where: { slaId: id },
  });

  if (linkedRequests > 0) {
    throw createError(
      "This SLA is already assigned to service requests and cannot be deleted.",
      409,
    );
  }

  await db.sLA.delete({ where: { id } });

  return { id };
};

// Find the most appropriate SLA for a new service request.
// Department-specific policy takes precedence over global policy.
export const getApplicableSla = async (priority, departmentId, db = prisma) => {
  if (departmentId) {
    const departmentSla = await db.sLA.findFirst({
      where: {
        priority,
        departmentId,
      },
      select: slaSelect,
    });

    if (departmentSla) {
      return departmentSla;
    }
  }

  const globalSla = await db.sLA.findFirst({
    where: {
      priority,
      departmentId: null,
    },
    select: slaSelect,
  });

  if (!globalSla) {
    throw createError(
      `No SLA policy configured for priority ${priority}.`,
      422,
    );
  }

  return globalSla;
};

// Calculate response and resolution deadlines.
export const calculateSlaDeadlines = (sla, startDate = new Date()) => {
  if (!sla) {
    throw createError("SLA policy is required.");
  }

  const responseDueAt = new Date(
    startDate.getTime() + sla.responseMinutes * 60 * 1000,
  );

  const resolutionDueAt = new Date(
    startDate.getTime() + sla.resolutionMinutes * 60 * 1000,
  );

  return {
    responseDueAt,
    resolutionDueAt,
  };
};
