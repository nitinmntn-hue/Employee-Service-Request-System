import express from "express";

import {
  getDashboard,
  getDashboardOverview,
} from "../controllers/dashboard.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

// All dashboard endpoints require authentication.
router.use(authenticate);

// Complete role-based dashboard.
router.get("/", getDashboard);

// Dashboard statistics only.
router.get("/overview", getDashboardOverview);

export default router;
