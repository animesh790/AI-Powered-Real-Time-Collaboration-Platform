
const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const mongoose = require("mongoose");

const File = require("../models/File");
const Workspace = require("../models/Workspace");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const uploadDirectory = path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    cb(null, crypto.randomUUID() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(authMiddleware);

async function checkWorkspaceAccess(workspaceId, userId) {
  if (!mongoose.isValidObjectId(workspaceId)) {
    return null;
  }

  return Workspace.findOne({
    _id: workspaceId,
    members: userId,
  });
}

// Upload a file to a workspace
router.post(
  "/:workspaceId",
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (error) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File size must not exceed 10 MB.",
          });
        }

        return res.status(400).json({
          success: false,
          message: "File upload failed. Please try another file.",
        });
      }

      next();
    });
  },
  async (req, res) => {
    let savedFile;

    try {
      const workspace = await checkWorkspaceAccess(
        req.params.workspaceId,
        req.userId
      );

      if (!workspace) {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }

        return res.status(404).json({
          success: false,
          message: "Workspace not found or access denied.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a file.",
        });
      }

      savedFile = await File.create({
        workspace: workspace._id,
        uploadedBy: req.userId,
        originalName: path.basename(req.file.originalname),
        storedName: req.file.filename,
        mimeType: req.file.mimetype || "application/octet-stream",
        size: req.file.size,
      });

      await savedFile.populate("uploadedBy", "name email");

      res.status(201).json({
        success: true,
        message: "File uploaded successfully.",
        file: savedFile,
      });
    } catch (error) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }

      res.status(500).json({
        success: false,
        message: "Could not upload the file.",
      });
    }
  }
);

// List files shared in a workspace
router.get("/:workspaceId", async (req, res) => {
  try {
    const workspace = await checkWorkspaceAccess(
      req.params.workspaceId,
      req.userId
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found or access denied.",
      });
    }

    const files = await File.find({
      workspace: workspace._id,
    })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      files,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load shared files.",
    });
  }
});

// Download a shared file
router.get("/download/:fileId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file ID.",
      });
    }

    const file = await File.findById(req.params.fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found.",
      });
    }

    const hasAccess = await checkWorkspaceAccess(
      file.workspace.toString(),
      req.userId
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this file.",
      });
    }

    const filePath = path.join(uploadDirectory, file.storedName);

    res.download(filePath, file.originalName, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({
          success: false,
          message: "File is unavailable on the server.",
        });
      }
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Could not download the file.",
      });
    }
  }
});

module.exports = router;
