
require("dotenv").config();

const documentRoutes = require("./routes/documentRoutes");

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const fileRoutes = require("./routes/fileRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const User = require("./models/User");
const Workspace = require("./models/Workspace");
const Message = require("./models/Message");
const Document = require("./models/Document");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
  },
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/documents", documentRoutes);

app.get("/", (req, res) => {
  res.send("AI-Powered Real-Time Collaboration Platform API is running!");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend server is working",
  });
});

app.get("/api/auth/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not retrieve profile",
    });
  }
});

// Authenticate Socket.IO connections using the login JWT.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id || decoded.userId;

    if (!socket.userId) {
      return next(new Error("Invalid authentication token"));
    }

    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
});

// Join a workspace and load recent chat history.
io.on("connection", (socket) => {
  console.log("User connected:", socket.userId);

  socket.on("join-workspace", async (workspaceId, callback) => {
    try {
      if (!mongoose.isValidObjectId(workspaceId)) {
        return callback?.({
          success: false,
          message: "Invalid workspace ID",
        });
      }

      const workspace = await Workspace.findOne({
        _id: workspaceId,
        members: socket.userId,
      });

      if (!workspace) {
        return callback?.({
          success: false,
          message: "Workspace not found or access denied",
        });
      }

      // Prevent this socket from staying in a previous workspace room.
      for (const room of socket.rooms) {
        if (room.startsWith("workspace:")) {
          socket.leave(room);
        }
      }

      const room = `workspace:${workspaceId}`;
      socket.join(room);

      const messages = await Message.find({
        workspace: workspaceId,
      })
        .populate("sender", "name")
        .sort({ createdAt: -1 })
        .limit(50);

      callback?.({
        success: true,
        messages: messages.reverse(),
      });
    } catch (error) {
      console.error("Join workspace error:", error);
      callback?.({
        success: false,
        message: "Could not join workspace",
      });
    }
  });

  socket.on("send-message", async (data, callback) => {
    try {
      const workspaceId = data?.workspaceId;
      const text = typeof data?.text === "string" ? data.text.trim() : "";

      if (!mongoose.isValidObjectId(workspaceId)) {
        return callback?.({
          success: false,
          message: "Invalid workspace ID",
        });
      }

      if (!text || text.length > 2000) {
        return callback?.({
          success: false,
          message: "Message must contain 1–2000 characters",
        });
      }

      const room = `workspace:${workspaceId}`;

      if (!socket.rooms.has(room)) {
        return callback?.({
          success: false,
          message: "Join this workspace before sending messages",
        });
        
  socket.on("join-document", async (documentId, callback) => {
    try {
      if (!mongoose.isValidObjectId(documentId)) {
        return callback?.({
          success: false,
          message: "Invalid document ID",
        });
      }

      const document = await Document.findById(documentId);

      if (!document) {
        return callback?.({
          success: false,
          message: "Document not found",
        });
      }

      const workspace = await Workspace.findOne({
        _id: document.workspace,
        members: socket.userId,
      });

      if (!workspace) {
        return callback?.({
          success: false,
          message: "Document access denied",
        });
      }

      // Leave any previously opened document room.
      for (const room of socket.rooms) {
        if (room.startsWith("document:")) {
          socket.leave(room);
        }
      }

      const room = `document:${documentId}`;
      socket.join(room);
      console.log("Joined document room:", documentId);

      callback?.({
        success: true,
        document: {
          _id: document._id,
          title: document.title,
          content: document.content,
          updatedAt: document.updatedAt,
        },
      });
    } catch (error) {
      console.error("Join document error:", error);
      callback?.({
        success: false,
        message: "Could not open document",
      });
    }
  });
  
  socket.on("document-update", async (data, callback) => {
    console.log("Received document-update event:", data.documentId);
    try {
      const documentId = data?.documentId;
      const content = data?.content;

      if (!mongoose.isValidObjectId(documentId)) {
        return callback?.({
          success: false,
          message: "Invalid document ID",
        });
      }

      if (typeof content !== "string" || content.length > 500000) {
        return callback?.({
          success: false,
          message: "Document content is invalid or too large",
        });
      }

      const room = `document:${documentId}`;

      if (!socket.rooms.has(room)) {
        return callback?.({
          success: false,
          message: "Join this document before editing",
        });
      }

      const document = await Document.findById(documentId);

      if (!document) {
        socket.leave(room);
        return callback?.({
          success: false,
          message: "Document not found",
        });
      }

      const workspace = await Workspace.findOne({
        _id: document.workspace,
        members: socket.userId,
      });

      if (!workspace) {
        socket.leave(room);
        return callback?.({
          success: false,
          message: "Document access denied",
        });
      }

      document.content = content;
      document.updatedBy = socket.userId;
      await document.save();

      io.to(room).emit("document-changed", {
        documentId: document._id,
        content: document.content,
        updatedAt: document.updatedAt,
        updatedBy: socket.userId,
      });

      callback?.({
        success: true,
        updatedAt: document.updatedAt,
      });
    } catch (error) {
      console.error("Document update error:", error);
      callback?.({
        success: false,
        message: "Could not save document changes",
      });
    }
  });


      }

      const workspace = await Workspace.findOne({
        _id: workspaceId,
        members: socket.userId,
      });

      if (!workspace) {
        socket.leave(room);

        return callback?.({
          success: false,
          message: "Workspace access denied",
        });
      }

      const message = await Message.create({
        workspace: workspaceId,
        sender: socket.userId,
        text,
      });

      await message.populate("sender", "name");

      io.to(room).emit("new-message", message);

      callback?.({ success: true });
    } catch (error) {
      console.error("Send message error:", error);
      callback?.({
        success: false,
        message: "Could not send message",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.userId);
  });
});

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log("Socket.IO real-time chat is ready");
  });
};

startServer();
