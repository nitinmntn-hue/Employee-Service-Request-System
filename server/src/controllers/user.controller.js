import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/database.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  departmentId: true,
  createdAt: true,
  updatedAt: true,
};

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(100),
  role: z.enum(["EMPLOYEE", "SUPPORT_STAFF", "ADMIN"]).default("EMPLOYEE"),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).default("ACTIVE"),
  departmentId: z.string().optional().nullable(),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(["EMPLOYEE", "SUPPORT_STAFF", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
  departmentId: z.string().optional().nullable(),
});

const sendError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// GET /api/v1/users
export const getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const { search, role, status, departmentId } = req.query;

    const where = {
      ...(search && {
        OR: [
          { name: { contains: String(search), mode: "insensitive" } },
          { email: { contains: String(search), mode: "insensitive" } },
        ],
      }),
      ...(role && { role: String(role) }),
      ...(status && { status: String(status) }),
      ...(departmentId && { departmentId: String(departmentId) }),
    };

    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
      pagination: {
        currentPage: page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/:id
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      return next(sendError("User not found", 404));
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/users
export const createUser = async (req, res, next) => {
  try {
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues,
      });
    }

    const { name, email, password, role, status, departmentId } =
      validation.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return next(sendError("Email is already registered", 409));
    }

    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });

      if (!department) {
        return next(sendError("Department not found", 404));
      }
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
    );

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role,
        status,
        ...(departmentId !== undefined && { departmentId }),
      },
      select: userSelect,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(sendError("Email is already registered", 409));
    }

    next(error);
  }
};

// PATCH /api/v1/users/:id
export const updateUser = async (req, res, next) => {
  try {
    const validation = updateUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues,
      });
    }

    const { id } = req.params;
    const updateData = { ...validation.data };

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return next(sendError("User not found", 404));
    }

    if (updateData.email) {
      const emailOwner = await prisma.user.findUnique({
        where: { email: updateData.email },
      });

      if (emailOwner && emailOwner.id !== id) {
        return next(sendError("Email is already in use", 409));
      }
    }

    if (updateData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: updateData.departmentId },
      });

      if (!department) {
        return next(sendError("Department not found", 404));
      }
    }

    if (updateData.password) {
      updateData.passwordHash = await bcrypt.hash(
        updateData.password,
        Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
      );

      delete updateData.password;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(sendError("Email is already in use", 409));
    }

    next(error);
  }
};

// PATCH /api/v1/users/:id/status
export const updateUserStatus = async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
    });

    const validation = schema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "A valid status is required",
        errors: validation.error.issues,
      });
    }

    const { id } = req.params;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return next(sendError("User not found", 404));
    }

    // Prevent an administrator from deactivating their own account.
    if (id === req.user.id && validation.data.status !== "ACTIVE") {
      return next(
        sendError("You cannot deactivate or block your own account", 403),
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: validation.data.status },
      select: userSelect,
    });

    return res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
