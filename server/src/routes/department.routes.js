import { Router } from "express";

import validate from "../middleware/validate.middleware.js";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  updateDepartmentStatus,
} from "../controllers/department.controller.js";

import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentQuerySchema,
  updateDepartmentStatusSchema,
  departmentIdSchema,
} from "../validators/department.validator.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

// All department routes require authentication.
router.use(authenticate);

// View departments
router.get(
  "/",
  authorizeRoles("ADMIN", "SUPPORT_STAFF"),
  validate(departmentQuerySchema, "query"),
  getAllDepartments,
);

router.get(
  "/:id",
  authorizeRoles("ADMIN", "SUPPORT_STAFF"),
  validate(departmentIdSchema, "params"),
  getDepartmentById,
);

// Only administrators can manage departments.
router.post(
  "/",
  authorizeRoles("ADMIN"),
  validate(createDepartmentSchema),
  createDepartment,
);

router.patch(
  "/:id",
  authorizeRoles("ADMIN"),
  validate(departmentIdSchema, "params"),
  validate(updateDepartmentSchema),
  updateDepartment,
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN"),
  validate(departmentIdSchema, "params"),
  validate(updateDepartmentStatusSchema),
  updateDepartmentStatus,
);

export default router;
