import { z } from "zod";

export const departmentIdSchema = z.object({
  id: z.string().uuid("Invalid department ID."),
});

export const createDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Department name must contain at least 2 characters.")
    .max(100, "Department name cannot exceed 100 characters."),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters.")
    .optional()
    .nullable(),
});

export const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),

    description: z.string().trim().max(500).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update.",
  });

export const updateDepartmentStatusSchema = z.object({
  isActive: z.boolean({
    error: "isActive must be a boolean.",
  }),
});

export const departmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional(),

  isActive: z.enum(["true", "false"]).optional(),
});
