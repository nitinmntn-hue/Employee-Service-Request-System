import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import notFoundMiddleware from "./middleware/notFound.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import requestRoutes from "./routes/request.routes.js";
import assignmentRoutes from "./routes/assignment.routes.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import notificationRoutes from "./routes/notification.route.js";
import commentRoutes from "./routes/comment.route.js";
import slaRoutes from "./routes/sla.routes.js";
import attachmentRoutes from "./routes/attachment.routes.js";
import activityLogRoutes from "./routes/activityLog.routes.js";

const app = express();

// TEMPORARY DEBUG LOGGER

app.use((req, res, next) => {
  console.log("REQUEST RECEIVED:", req.method, req.originalUrl);

  res.on("finish", () => {
    console.log("RESPONSE SENT:", res.statusCode);
  });

  next();
});
// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
      : [],
    credentials: true,
  }),
);

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Logger
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Root endpoint
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Employee Service Request API is running",
  });
});

// Health endpoint - BEFORE API ROUTES
app.get("/api/v1/health", (req, res) => {
  console.log("HEALTH ROUTE REACHED");

  return res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/requests", requestRoutes);
app.use("/api/v1/assignments", assignmentRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/comments", commentRoutes);
app.use("/api/v1/attachments", attachmentRoutes);
app.use("/api/v1/activity-logs", activityLogRoutes);
app.use("/api/v1/slas", slaRoutes);

// 404 handler
app.use(notFoundMiddleware);

// Global error handler - LAST
app.use(errorMiddleware);

export default app;
