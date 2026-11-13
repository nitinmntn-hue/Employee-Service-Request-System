import { Router } from "express";

import {
  getRequestComments,
  createComment,
  getCommentById,
  updateComment,
  deleteComment,
} from "../controllers/comment.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

// Request comments
router.get("/requests/:requestId", getRequestComments);
router.post("/requests/:requestId", createComment);

// Individual comment
router.get("/:commentId", getCommentById);
router.patch("/:commentId", updateComment);
router.delete("/:commentId", deleteComment);

export default router;
