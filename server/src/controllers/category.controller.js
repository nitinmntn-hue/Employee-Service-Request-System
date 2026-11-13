import { z } from "zod";
import { prisma } from "../config/database.js";

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  departmentId: z.string().min(1, "Department is required"),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  departmentId: z.string().min(1).optional(),
});

const statusSchema = z.object({
  isActive: z.boolean(),
});

const categorySelect = {
  id: true,
  name: true,
  description: true,
  departmentId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
};

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Check whether a department exists and is active
const validateDepartment = async (departmentId) => {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  if (!department) {
    throw createError("Department not found", 404);
  }

  if (!department.isActive) {
    throw createError(
      "Cannot assign a category to an inactive department",
      400,
    );
  }

  return department;
};

// GET /api/v1/categories
export const getAllCategories = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();

    const where = {
      ...(search && {
        OR: [
          {
            name: {
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
      ...(req.query.departmentId && {
        departmentId: String(req.query.departmentId),
      }),
      ...(req.query.isActive !== undefined && {
        isActive: req.query.isActive === "true",
      }),
    };

    const [categories, totalCategories] = await Promise.all([
      prisma.category.findMany({
        where,
        select: categorySelect,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.category.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
      pagination: {
        currentPage: page,
        limit,
        totalCategories,
        totalPages: Math.ceil(totalCategories / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/categories/:id
export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      select: categorySelect,
    });

    if (!category) {
      return next(createError("Category not found", 404));
    }

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/categories
export const createCategory = async (req, res, next) => {
  try {
    const validation = createCategorySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues,
      });
    }

    const { name, description, departmentId } = validation.data;

    await validateDepartment(departmentId);

    // Prevent duplicate category names within the same department
    const existingCategory = await prisma.category.findFirst({
      where: {
        name,
        departmentId,
      },
    });

    if (existingCategory) {
      return next(
        createError(
          "This category already exists in the selected department",
          409,
        ),
      );
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        departmentId,
      },
      select: categorySelect,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(
        createError("Category already exists in this department", 409),
      );
    }

    next(error);
  }
};

// PATCH /api/v1/categories/:id
export const updateCategory = async (req, res, next) => {
  try {
    const validation = updateCategorySchema.safeParse(req.body);

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

    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return next(createError("Category not found", 404));
    }

    const targetDepartmentId =
      updateData.departmentId ?? existingCategory.departmentId;

    if (updateData.departmentId) {
      await validateDepartment(updateData.departmentId);
    }

    if (updateData.name || updateData.departmentId) {
      const duplicate = await prisma.category.findFirst({
        where: {
          name: updateData.name ?? existingCategory.name,
          departmentId: targetDepartmentId,
          NOT: { id },
        },
      });

      if (duplicate) {
        return next(
          createError(
            "This category already exists in the selected department",
            409,
          ),
        );
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      select: categorySelect,
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(
        createError("Category already exists in this department", 409),
      );
    }

    next(error);
  }
};

// PATCH /api/v1/categories/:id/status
export const updateCategoryStatus = async (req, res, next) => {
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

    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return next(createError("Category not found", 404));
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        isActive: validation.data.isActive,
      },
      select: categorySelect,
    });

    return res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? "activated" : "deactivated"} successfully`,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};
