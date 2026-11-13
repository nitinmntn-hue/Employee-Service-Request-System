import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

import {
  getAllActivityLogs,
  getRequestLogs,
  getActivityLog,
} from "../controllers/activityLog.controller.js";

const router = Router();

router.use(authenticate);

// Admin: view all activity logs
router.get("/", authorizeRoles("ADMIN"), getAllActivityLogs);

// View activity history of a specific request
router.get("/requests/:requestId", getRequestLogs);

// View one activity log
router.get("/:activityLogId", getActivityLog);

export default router;
