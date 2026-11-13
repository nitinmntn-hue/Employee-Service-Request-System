import { Router } from "express";

import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
} from "../controllers/user.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

// All user-management routes require authentication.
router.use(authenticate);

// Admin and support staff can view users.
router.get("/", authorizeRoles("ADMIN", "SUPPORT_STAFF"), getAllUsers);

router.get("/:id", authorizeRoles("ADMIN", "SUPPORT_STAFF"), getUserById);

// Only administrators can create or modify accounts.
router.post("/", authorizeRoles("ADMIN"), createUser);

router.patch("/:id", authorizeRoles("ADMIN"), updateUser);

router.patch("/:id/status", authorizeRoles("ADMIN"), updateUserStatus);

export default router;
