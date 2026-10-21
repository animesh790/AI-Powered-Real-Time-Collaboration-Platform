
const express = require("express");
const mongoose = require("mongoose");

const Document = require("../models/Document");
const Workspace = require("../models/Workspace");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

async function getWorkspaceAccess(workspaceId, userId) {
  if (!mongoose.isValidObjectId(workspaceId)) {
    return null;
  }

  return Workspace.findOne({
    _id: workspaceId,
    members: userId,
  });
}

// Create a document
router.post("/:workspaceId", async (req, res) => {
  try {
    const { title } = req.body;
    const workspace = await getWorkspaceAccess(
      req.params.workspaceId,
      req.userId
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found or access denied.",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Document title is required.",
      });
    }

    const document = await Document.create({
      workspace: workspace._id,
      createdBy: req.userId,
      updatedBy: req.userId,
      title: title.trim(),
      content: "",
    });

    res.status(201).json({
      success: true,
      message: "Document created successfully.",
      document,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not create document.",
    });
  }
});

// List documents in a workspace
router.get("/workspace/:workspaceId", async (req, res) => {
  try {
    const workspace = await getWorkspaceAccess(
      req.params.workspaceId,
      req.userId
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found or access denied.",
      });
    }

    const documents = await Document.find({
      workspace: workspace._id,
    })
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ updatedAt: -1 });

    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load documents.",
    });
  }
});

// Get one document
router.get("/:documentId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    const document = await Document.findById(
      req.params.documentId
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const workspace = await getWorkspaceAccess(
      document.workspace.toString(),
      req.userId
    );

    if (!workspace) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this document.",
      });
    }

    res.json({ success: true, document });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load document.",
    });
  }
});

// Save document content
router.put("/:documentId", async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!mongoose.isValidObjectId(req.params.documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (typeof content !== "string" || content.length > 500000) {
      return res.status(400).json({
        success: false,
        message: "Document content is invalid or too large.",
      });
    }

    if (
      title !== undefined &&
      (typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 150)
    ) {
      return res.status(400).json({
        success: false,
        message: "Title must contain 1–150 characters.",
      });
    }

    const document = await Document.findById(
      req.params.documentId
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const workspace = await getWorkspaceAccess(
      document.workspace.toString(),
      req.userId
    );

    if (!workspace) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this document.",
      });
    }

    document.content = content;

    if (title !== undefined) {
      document.title = title.trim();
    }

    document.updatedBy = req.userId;

    await document.save();

    res.json({
      success: true,
      message: "Document saved successfully.",
      document,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not save document.",
    });
  }
});

module.exports = router;
