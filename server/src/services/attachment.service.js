import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// --------------------------------------------------
// STORAGE CONFIGURATION
// --------------------------------------------------

const STORAGE_DIRECTORY = path.resolve(process.cwd(), "uploads", "attachments");

// --------------------------------------------------
// CREATE STORAGE DIRECTORY
// --------------------------------------------------

export const ensureAttachmentDirectory = async () => {
  await fs.mkdir(STORAGE_DIRECTORY, {
    recursive: true,
  });
};

// --------------------------------------------------
// GENERATE SAFE STORAGE KEY
// --------------------------------------------------

const getExtension = (fileName) => {
  const extension = path.extname(fileName || "").toLowerCase();

  // Do not preserve unusually long or suspicious extensions.
  if (!/^\.[a-z0-9]{1,10}$/.test(extension)) {
    return "";
  }

  return extension;
};

export const generateStorageKey = (fileName) => {
  const extension = getExtension(fileName);

  return `${randomUUID()}${extension}`;
};

// --------------------------------------------------
// SAVE ATTACHMENT FILE
// --------------------------------------------------

export const saveAttachmentFile = async (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error("Invalid uploaded file");
  }

  await ensureAttachmentDirectory();

  const storageKey = generateStorageKey(file.originalname);

  const filePath = path.join(STORAGE_DIRECTORY, storageKey);

  await fs.writeFile(filePath, file.buffer, {
    flag: "wx",
  });

  return {
    storageKey,
    filePath,
  };
};

// --------------------------------------------------
// GET ATTACHMENT FILE PATH
// --------------------------------------------------

export const getAttachmentFilePath = (storageKey) => {
  if (
    typeof storageKey !== "string" ||
    !/^[a-f0-9-]{36}(\.[a-z0-9]{1,10})?$/i.test(storageKey)
  ) {
    throw new Error("Invalid attachment storage key");
  }

  const filePath = path.resolve(STORAGE_DIRECTORY, storageKey);

  if (path.dirname(filePath) !== STORAGE_DIRECTORY) {
    throw new Error("Invalid attachment file path");
  }

  return filePath;
};

// --------------------------------------------------
// CHECK FILE EXISTS
// --------------------------------------------------

export const attachmentFileExists = async (storageKey) => {
  try {
    const filePath = getAttachmentFilePath(storageKey);

    await fs.access(filePath);

    return true;
  } catch {
    return false;
  }
};

// --------------------------------------------------
// DELETE ATTACHMENT FILE
// --------------------------------------------------

export const deleteAttachmentFile = async (storageKey) => {
  const filePath = getAttachmentFilePath(storageKey);

  try {
    await fs.unlink(filePath);

    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

// --------------------------------------------------
// GET FILE INFORMATION
// --------------------------------------------------

export const getAttachmentFileInfo = async (storageKey) => {
  const filePath = getAttachmentFilePath(storageKey);

  const stats = await fs.stat(filePath);

  if (!stats.isFile()) {
    throw new Error("Attachment is not a regular file");
  }

  return {
    filePath,
    size: stats.size,
  };
};
