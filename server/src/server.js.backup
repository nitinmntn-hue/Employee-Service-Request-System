import "dotenv/config";
import app from "./app.js";
import { connectDB, prisma } from "./config/database.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
      throw new Error("Required environment variables are missing");
    }

    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log("Shutting down server...");

      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
