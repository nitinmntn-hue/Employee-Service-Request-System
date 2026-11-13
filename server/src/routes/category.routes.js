import { Router } from "express";

import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
} from "../controllers/category.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

// All category routes require authentication
router.use(authenticate);

// Admin and support staff can view categories
router.get(
  "/",
  authorizeRoles("ADMIN", "SUPPORT_STAFF", "EMPLOYEE"),
  getAllCategories,
);

router.get(
  "/:id",
  authorizeRoles("ADMIN", "SUPPORT_STAFF", "EMPLOYEE"),
  getCategoryById,
);

// Only admin can manage categories
router.post("/", authorizeRoles("ADMIN"), createCategory);

router.patch("/:id", authorizeRoles("ADMIN"), updateCategory);

router.patch("/:id/status", authorizeRoles("ADMIN"), updateCategoryStatus);

export default router;
