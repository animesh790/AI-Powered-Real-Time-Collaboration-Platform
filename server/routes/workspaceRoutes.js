
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Workspace = require("../models/Workspace");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Create a workspace
router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Workspace name is required.",
      });
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      description: description || "",
      owner: req.userId,
      members: [req.userId],
    });

    res.status(201).json({
      success: true,
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not create workspace.",
    });
  }
});

// Get workspaces belonging to the logged-in user
router.get("/", async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      members: req.userId,
    })
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      workspaces,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load workspaces.",
    });
  }
});

// Invite an existing user by email
router.post("/:id/members", async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.body.email?.trim().toLowerCase();

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "User email is required.",
      });
    }

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    if (workspace.owner.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner can invite members.",
      });
    }

    const invitedUser = await User.findOne({ email });

    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: "No registered user found with this email.",
      });
    }

    const alreadyMember = workspace.members.some(
      (memberId) => memberId.toString() === invitedUser._id.toString()
    );

    if (alreadyMember) {
      return res.status(409).json({
        success: false,
        message: "This user is already a workspace member.",
      });
    }

    workspace.members.push(invitedUser._id);
    await workspace.save();

    res.status(200).json({
      success: true,
      message: `${invitedUser.name} has been added to the workspace.`,
      member: {
        _id: invitedUser._id,
        name: invitedUser.name,
        email: invitedUser.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not invite the user.",
    });
  }
});

// Get a specific workspace
router.get("/:id", async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.id,
      members: req.userId,
    })
      .populate("owner", "name email")
      .populate("members", "name email");

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found or access denied.",
      });
    }

    res.json({
      success: true,
      workspace,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load workspace.",
    });
  }
});

module.exports = router;
