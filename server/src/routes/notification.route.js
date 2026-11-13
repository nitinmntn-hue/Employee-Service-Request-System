import express from "express";

import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

// Every notification endpoint requires authentication.
router.use(authenticate);

// Get unread notification count.
router.get("/unread-count", getUnreadNotificationCount);

// Get logged-in user's notifications.
router.get("/", getMyNotifications);

// Mark all notifications as read.
router.patch("/read-all", markAllNotificationsAsRead);

// Mark one notification as read.
router.patch("/:notificationId/read", markNotificationAsRead);

// Delete one notification.
router.delete("/:notificationId", deleteNotification);

export default router;
