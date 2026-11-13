import { z } from "zod";
import { prisma } from "../config/database.js";

// Validation schemas
const createDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Department name must contain at least 2 characters")
    .max(100),
  description: z.string().trim().max(500).optional().nullable(),
});

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

const statusSchema = z.object({
  isActive: z.boolean(),
});

const departmentSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      users: true,
    },
  },
};

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// GET /api/v1/departments
export const getAllDepartments = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();

    const where = {
      ...(search && {
        name: {
          contains: search,
          mode: "insensitive",
        },
      }),
      ...(req.query.isActive !== undefined && {
        isActive: req.query.isActive === "true",
      }),
    };

    const [departments, totalDepartments] = await Promise.all([
      prisma.department.findMany({
        where,
        select: departmentSelect,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.department.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Departments retrieved successfully",
      data: departments,
      pagination: {
        currentPage: page,
        limit,
        totalDepartments,
        totalPages: Math.ceil(totalDepartments / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/departments/:id
export const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      select: departmentSelect,
    });

    if (!department) {
      return next(createError("Department not found", 404));
    }

    return res.status(200).json({
      success: true,
      message: "Department retrieved successfully",
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/departments
export const createDepartment = async (req, res, next) => {
  try {
    const validation = createDepartmentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues,
      });
    }

    const { name, description } = validation.data;

    const existingDepartment = await prisma.department.findUnique({
      where: { name },
    });

    if (existingDepartment) {
      return next(createError("Department already exists", 409));
    }

    const department = await prisma.department.create({
      data: {
        name,
        description,
      },
      select: departmentSelect,
    });

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(createError("Department already exists", 409));
    }

    next(error);
  }
};

// PATCH /api/v1/departments/:id
export const updateDepartment = async (req, res, next) => {
  try {
    const validation = updateDepartmentSchema.safeParse(req.body);

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

    const existingDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!existingDepartment) {
      return next(createError("Department not found", 404));
    }

    if (updateData.name) {
      const duplicate = await prisma.department.findUnique({
        where: { name: updateData.name },
      });

      if (duplicate && duplicate.id !== id) {
        return next(createError("Department name already exists", 409));
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data: updateData,
      select: departmentSelect,
    });

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(createError("Department name already exists", 409));
    }

    next(error);
  }
};

// PATCH /api/v1/departments/:id/status
export const updateDepartmentStatus = async (req, res, next) => {
  try {
    const validation = statusSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
        errors: validation.error.issues,
      });
    }

    const { id } = req.params;

    const existingDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!existingDepartment) {
      return next(createError("Department not found", 404));
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        isActive: validation.data.isActive,
      },
      select: departmentSelect,
    });

    return res.status(200).json({
      success: true,
      message: `Department ${department.isActive ? "activated" : "deactivated"} successfully`,
      data: department,
    });
  } catch (error) {
    next(error);
  }
};
