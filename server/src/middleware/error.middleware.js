const errorMiddleware = (err, req, res, next) => {
  console.error("API Error:", {
    message: err.message,
    method: req.method,
    path: req.originalUrl,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal Server Error";

  // Prisma known request errors
  if (err.code === "P2002") {
    statusCode = 409;
    message = "A record with this value already exists.";
  } else if (err.code === "P2025") {
    statusCode = 404;
    message = "Requested record was not found.";
  } else if (err.code === "P2003") {
    statusCode = 400;
    message = "Invalid related record reference.";
  } else if (err.code === "P2023") {
    statusCode = 400;
    message = "Invalid ID or data format.";
  }

  // Invalid JSON body
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON request body.";
  }

  // Multer upload errors
  if (err.name === "MulterError") {
    statusCode = 400;
    message = err.message;
  }

  // Do not expose internal error details in production
  if (statusCode >= 500 && process.env.NODE_ENV === "production") {
    message = "Internal Server Error";
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};

export default errorMiddleware;
