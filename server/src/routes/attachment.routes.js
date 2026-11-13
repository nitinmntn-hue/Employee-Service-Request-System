import { Router } from "express";

import {
  uploadAttachment,
  getRequestAttachments,
  downloadAttachment,
  deleteAttachment,
} from "../controllers/attachment.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";

const router = Router();

router.use(authenticate);

// Upload attachment
router.post("/requests/:requestId", upload.single("file"), uploadAttachment);

// List attachments
router.get("/requests/:requestId", getRequestAttachments);

// Download attachment
router.get("/:attachmentId/download", downloadAttachment);

// Delete attachment
router.delete("/:attachmentId", deleteAttachment);

export default router;
