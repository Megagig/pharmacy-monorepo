import express from "express";
import { body, validationResult } from "express-validator";
import { auth } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { notificationValidationSchema } from "../middlewares/communicationValidation";
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markMultipleAsRead,
  dismissNotification,
  getUnreadCount,
  getNotificationPreferences,
  updateNotificationPreferences,
  createConversationNotification,
  createPatientQueryNotification,
  getNotificationStatistics,
  processScheduledNotifications,
  retryFailedNotifications,
  sendTestNotification,
  archiveOldNotifications,
  deleteExpiredNotifications,
} from "../controllers/notificationController";

const router = express.Router();

// Validation middleware function
const validateNotification = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void => {
  const { error } = notificationValidationSchema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: error.details,
    });
    return;
  }
  next();
};

// Apply authentication to all routes
router.use(auth);

// Basic notification routes
router.get("/", getUserNotifications);
router.post("/", validateNotification, createNotification);
router.get("/unread-count", getUnreadCount);
router.get("/statistics", getNotificationStatistics);

// Individual notification actions
router.patch("/:notificationId/read", markNotificationAsRead);
router.patch("/:notificationId/dismiss", dismissNotification);

// Batch operations
router.patch("/mark-multiple-read", markMultipleAsRead);
router.post("/archive-old", archiveOldNotifications);

// Notification preferences
router.get("/preferences", getNotificationPreferences);
router.put("/preferences", updateNotificationPreferences);

// Communication-specific notifications
router.post("/conversation", createConversationNotification);
router.post("/patient-query", createPatientQueryNotification);

// Testing and utilities
router.post("/test", sendTestNotification);

// Admin-only routes
router.post(
  "/process-scheduled",
  requireRole("admin", "super_admin"),
  processScheduledNotifications,
);
router.post(
  "/retry-failed",
  requireRole("admin", "super_admin"),
  retryFailedNotifications,
);
router.delete(
  "/expired",
  requireRole("admin", "super_admin"),
  deleteExpiredNotifications,
);

export default router;
