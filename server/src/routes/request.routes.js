import { Router } from "express";

import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  updateRequestStatus,
} from "../controllers/request.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

// All request routes require authentication
router.use(authenticate);

// Employees, support staff and admins can list requests.
// The controller applies role-based data filtering.
router.get("/", getAllRequests);

// View an individual request.
// The controller checks ownership and department access.
router.get("/:id", getRequestById);

// All authenticated roles can submit requests.
router.post("/", createRequest);

// Employees can edit their own OPEN requests.
// Admins can edit any request.
router.patch("/:id", authorizeRoles("EMPLOYEE", "ADMIN"), updateRequest);

// Only support staff and admins can update request status.
router.patch(
  "/:id/status",
  authorizeRoles("SUPPORT_STAFF", "ADMIN"),
  updateRequestStatus,
);

export default router;
