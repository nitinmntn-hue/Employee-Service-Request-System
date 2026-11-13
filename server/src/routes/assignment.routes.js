import { Router } from "express";

import {
  assignRequest,
  reassignRequest,
  getRequestAssignmentHistory,
  getAssignmentById,
  getAllAssignments,
} from "../controllers/assignment.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.use(authenticate);

// Get assignment list.
router.get("/", getAllAssignments);

// Assign a request.
router.post(
  "/requests/:requestId",
  authorizeRoles("ADMIN", "SUPPORT_STAFF"),
  assignRequest,
);

// Reassign a request.
router.patch(
  "/:assignmentId/reassign",
  authorizeRoles("ADMIN", "SUPPORT_STAFF"),
  reassignRequest,
);

// Get request assignment history.
router.get("/requests/:requestId", getRequestAssignmentHistory);

// Get assignment details.
router.get("/:assignmentId", getAssignmentById);

export default router;
