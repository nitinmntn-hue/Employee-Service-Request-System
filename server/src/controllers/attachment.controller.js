import path from "node:path";
import { z } from "zod";

import { prisma } from "../config/database.js";

import {
  saveAttachmentFile,
  getAttachmentFilePath,
  deleteAttachmentFile,
} from "../services/attachment.service.js";

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

const uuidSchema = z.string().uuid("A valid UUID is required");

const validateUuidParam = (value, res, label = "ID") => {
  const result = uuidSchema.safeParse(value);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: `Invalid ${label}`,
    });

    return false;
  }

  return true;
};

// --------------------------------------------------
// SELECT
// --------------------------------------------------

const attachmentSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  requestId: true,
  uploadedById: true,
  createdAt: true,

  uploadedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

// --------------------------------------------------
// REQUEST ACCESS
// --------------------------------------------------

const canAccessRequest = async (user, request, db = prisma) => {
  if (!request) {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  if (user.role === "EMPLOYEE" && request.requesterId === user.id) {
    return true;
  }

  if (user.role === "SUPPORT_STAFF") {
    if (user.departmentId && user.departmentId === request.departmentId) {
      return true;
    }

    const assignment = await db.assignment.findFirst({
      where: {
        requestId: request.id,
        assigneeId: user.id,
      },

      select: {
        id: true,
      },
    });

    return Boolean(assignment);
  }

  return false;
};

// --------------------------------------------------
// GET REQUEST
// --------------------------------------------------

const getRequest = async (requestId, db = prisma) => {
  return db.serviceRequest.findUnique({
    where: {
      id: requestId,
    },

    select: {
      id: true,
      requestCode: true,
      requesterId: true,
      departmentId: true,
    },
  });
};

// --------------------------------------------------
// SAFE DOWNLOAD NAME
// --------------------------------------------------

const sanitizeDownloadName = (fileName) => {
  return path.basename(fileName).replace(/[\r\n"]/g, "_");
};

// --------------------------------------------------
// UPLOAD ATTACHMENT
// POST /api/v1/attachments/requests/:requestId
// --------------------------------------------------

export const uploadAttachment = async (req, res) => {
  let savedFile = null;

  try {
    const idValidation = uuidSchema.safeParse(req.params.requestId);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a file to upload",
      });
    }

    const request = await getRequest(idValidation.data);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to upload attachments",
      });
    }

    // Save file to local storage first.
    savedFile = await saveAttachmentFile(req.file);

    // Save metadata and activity log transactionally.
    const attachment = await prisma.$transaction(async (tx) => {
      const createdAttachment = await tx.attachment.create({
        data: {
          fileName: sanitizeDownloadName(req.file.originalname),
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          storageKey: savedFile.storageKey,
          requestId: request.id,
          uploadedById: req.user.id,
        },

        select: attachmentSelect,
      });

      await tx.activityLog.create({
        data: {
          action: "ATTACHMENT_UPLOADED",
          actorId: req.user.id,
          requestId: request.id,

          details: {
            attachmentId: createdAttachment.id,
            fileName: createdAttachment.fileName,
            sizeBytes: createdAttachment.sizeBytes,
          },
        },
      });

      return createdAttachment;
    });

    return res.status(201).json({
      success: true,
      message: "Attachment uploaded successfully",
      data: attachment,
    });
  } catch (error) {
    // Remove physical file if database operation fails.
    if (savedFile?.storageKey) {
      try {
        await deleteAttachmentFile(savedFile.storageKey);
      } catch (cleanupError) {
        console.error("Attachment cleanup error:", cleanupError);
      }
    }

    console.error("Upload attachment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload attachment",
    });
  }
};

// --------------------------------------------------
// GET REQUEST ATTACHMENTS
// GET /api/v1/attachments/requests/:requestId
// --------------------------------------------------

export const getRequestAttachments = async (req, res) => {
  try {
    const idValidation = uuidSchema.safeParse(req.params.requestId);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
    }

    const request = await getRequest(idValidation.data);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view these attachments",
      });
    }

    const attachments = await prisma.attachment.findMany({
      where: {
        requestId: request.id,
      },

      select: attachmentSelect,

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Attachments fetched successfully",
      count: attachments.length,
      data: attachments,
    });
  } catch (error) {
    console.error("Get attachments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attachments",
    });
  }
};

// --------------------------------------------------
// DOWNLOAD ATTACHMENT
// GET /api/v1/attachments/:attachmentId/download
// --------------------------------------------------

export const downloadAttachment = async (req, res) => {
  try {
    const idValidation = uuidSchema.safeParse(req.params.attachmentId);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid attachment ID",
      });
    }

    const attachment = await prisma.attachment.findUnique({
      where: {
        id: idValidation.data,
      },
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found",
      });
    }

    const request = await getRequest(attachment.requestId);

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to download this attachment",
      });
    }

    const filePath = getAttachmentFilePath(attachment.storageKey);

    return res.download(
      filePath,
      sanitizeDownloadName(attachment.fileName),
      (error) => {
        if (error) {
          console.error("Download attachment error:", error);

          if (!res.headersSent) {
            res.status(404).json({
              success: false,
              message: "Attachment file is unavailable",
            });
          }
        }
      },
    );
  } catch (error) {
    console.error("Download attachment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to download attachment",
    });
  }
};

// --------------------------------------------------
// DELETE ATTACHMENT
// DELETE /api/v1/attachments/:attachmentId
// --------------------------------------------------

export const deleteAttachment = async (req, res) => {
  try {
    const idValidation = uuidSchema.safeParse(req.params.attachmentId);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid attachment ID",
      });
    }

    const attachment = await prisma.attachment.findUnique({
      where: {
        id: idValidation.data,
      },
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found",
      });
    }

    const request = await getRequest(attachment.requestId);

    const hasAccess = await canAccessRequest(req.user, request);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this attachment",
      });
    }

    // Only uploader or administrator can delete.
    if (attachment.uploadedById !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own attachments",
      });
    }

    // Delete metadata and create activity log in one transaction.
    await prisma.$transaction(async (tx) => {
      await tx.attachment.delete({
        where: {
          id: attachment.id,
        },
      });

      await tx.activityLog.create({
        data: {
          action: "ATTACHMENT_DELETED",
          actorId: req.user.id,
          requestId: attachment.requestId,

          details: {
            attachmentId: attachment.id,
            fileName: attachment.fileName,
          },
        },
      });
    });

    // Delete physical file after successful database commit.
    try {
      await deleteAttachmentFile(attachment.storageKey);
    } catch (fileError) {
      // Database record is already deleted. Log orphaned file for cleanup.
      console.error("Physical attachment deletion failed:", fileError);
    }

    return res.status(200).json({
      success: true,
      message: "Attachment deleted successfully",
    });
  } catch (error) {
    console.error("Delete attachment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete attachment",
    });
  }
};
