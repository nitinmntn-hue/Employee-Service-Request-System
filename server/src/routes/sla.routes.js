import { Router } from "express";
import { z } from "zod";

import validate from "../middleware/validate.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

import {
  getAllSlas,
  getSlaById,
  createSla,
  updateSla,
  deleteSla,
  getApplicableSlaPolicy,
} from "../controllers/sla.controller.js";

const router = Router();

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const slaIdSchema = z.object({
  id: z.string().uuid("Invalid SLA ID."),
});

const slaPrioritySchema = z.object({
  priority: z.enum(priorities),
});

const createSlaSchema = z
  .object({
    priority: z.enum(priorities),

    responseMinutes: z.coerce
      .number()
      .int()
      .min(1, "Response time must be at least 1 minute.")
      .max(525600),

    resolutionMinutes: z.coerce
      .number()
      .int()
      .min(1, "Resolution time must be at least 1 minute.")
      .max(525600),

    departmentId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => data.resolutionMinutes >= data.responseMinutes, {
    message: "Resolution time must be greater than or equal to response time.",
    path: ["resolutionMinutes"],
  });

const updateSlaSchema = z
  .object({
    priority: z.enum(priorities).optional(),

    responseMinutes: z.coerce.number().int().min(1).max(525600).optional(),

    resolutionMinutes: z.coerce.number().int().min(1).max(525600).optional(),

    departmentId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update.",
  });

const slaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  priority: z.enum(priorities).optional(),

  // Use "global" to filter global SLA policies.
  departmentId: z.union([z.string().uuid(), z.literal("global")]).optional(),
});

const applicableSlaQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
});

// All SLA routes require authentication.
router.use(authenticate);

// Get all SLA policies.
router.get(
  "/",
  authorizeRoles("ADMIN", "SUPPORT_STAFF"),
  validate(slaQuerySchema, "query"),
  getAllSlas,
);

// Get applicable SLA for a priority and optional department.
router.get(
  "/applicable/:priority",
  authorizeRoles("ADMIN", "SUPPORT_STAFF"),
  validate(slaPrioritySchema, "params"),
  validate(applicableSlaQuerySchema, "query"),
  getApplicableSlaPolicy,
);

// Get SLA by ID.
router.get(
  "/:id",
  authorizeRoles("ADMIN", "SUPPORT_STAFF"),
  validate(slaIdSchema, "params"),
  getSlaById,
);

// Create SLA policy.
router.post("/", authorizeRoles("ADMIN"), validate(createSlaSchema), createSla);

// Update SLA policy.
router.patch(
  "/:id",
  authorizeRoles("ADMIN"),
  validate(slaIdSchema, "params"),
  validate(updateSlaSchema),
  updateSla,
);

// Delete SLA policy.
router.delete(
  "/:id",
  authorizeRoles("ADMIN"),
  validate(slaIdSchema, "params"),
  deleteSla,
);

export default router;
