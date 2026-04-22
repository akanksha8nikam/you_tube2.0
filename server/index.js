import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";
import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyrroutes from "./routes/history.js";
import commentroutes from "./routes/comment.js";
import subscriptionroutes from "./routes/subscription.js";
import downloadroutes from "./routes/download.js";

dotenv.config();
const app = express();
const server = http.createServer(app);
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { uploadsDir } from "./filehelper/filehelper.js";

// Ensure uploads directory exists for production
const resolvedUploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), uploadsDir);
if (!fs.existsSync(resolvedUploadsDir)) {
  fs.mkdirSync(resolvedUploadsDir, { recursive: true });
  console.log("Created uploads directory at:", resolvedUploadsDir);
}
import { sendmail } from "./mails/mails.js";

// Robust CORS for production media streaming
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Range"],
  exposedHeaders: ["Content-Range", "Content-Length", "Accept-Ranges"],
  credentials: true
}));

app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));

// Serve static files with explicit headers for video streaming
app.use("/uploads", (req, res, next) => {
  console.log(`[Static] Request for: ${req.url}`);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Range");
  res.header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
  next();
}, express.static(resolvedUploadsDir));
app.use("/subscription", subscriptionroutes);
app.get("/", (req, res) => {
  res.send("You tube backend is working");
});

app.get("/api/health", async (req, res) => {
  const status = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    db: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    cloudinary: "Checking...",
  };

  try {
    const { default: cloudinaryInstance } = await import("./config/cloudinary.js");
    await cloudinaryInstance.api.ping();
    status.cloudinary = "Connected";
    res.status(200).json(status);
  } catch (err) {
    status.cloudinary = `Error: ${err.message}`;
    res.status(500).json(status);
  }
});

app.post("/api/send-mail", async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    if (!to || !subject || !text) {
      return res.status(400).json({ message: "to, subject, and text are required" });
    }
    // call your helper
    await sendmail(to, subject, text);
    return res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("Send mail error:", err);
    return res.status(500).json({ message: "Failed to send email" });
  }
});

app.use(bodyParser.json());
app.use("/user", userroutes);
app.use("/video", videoroutes);
app.use("/like", likeroutes);
app.use("/watch", watchlaterroutes);
app.use("/history", historyrroutes);
app.use("/comment", commentroutes);
app.use("/download", downloadroutes);
const PORT = process.env.PORT || 5000;

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = new Map();
const pendingDisconnects = new Map();

io.on("connection", (socket) => {
  socket.on("call:register", ({ userId }) => {
    if (!userId) return;
    const pendingKey = `${userId}::${socket.data.roomId || ""}`;
    if (pendingDisconnects.has(pendingKey)) {
      clearTimeout(pendingDisconnects.get(pendingKey));
      pendingDisconnects.delete(pendingKey);
    }
    socket.data.userId = userId;
    userSocketMap.set(userId, socket.id);
    socket.emit("call:registered", { userId });
  });

  socket.on("call:invite", ({ toUserId, fromUserId, roomId }) => {
    if (!toUserId || !fromUserId || !roomId) return;
    const targetSocketId = userSocketMap.get(toUserId);

    if (!targetSocketId) {
      socket.emit("call:invite-status", {
        ok: false,
        reason: "User is not available for call.",
      });
      return;
    }

    io.to(targetSocketId).emit("call:incoming", { roomId, fromUserId });
    socket.emit("call:invite-status", { ok: true });
  });

  socket.on("call:reject", ({ toUserId, fromUserId }) => {
    if (!toUserId || !fromUserId) return;
    const targetSocketId = userSocketMap.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:rejected", { fromUserId });
    }
  });

  socket.on("call:accept", ({ toUserId, fromUserId, roomId }) => {
    if (!toUserId || !fromUserId || !roomId) return;
    const targetSocketId = userSocketMap.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call:accepted", { fromUserId, roomId });
    }
  });

  socket.on("call:join", ({ roomId, userId }) => {
    if (!roomId || !userId) return;
    socket.data.roomId = roomId;
    socket.data.userId = userId;
    const pendingKey = `${userId}::${roomId}`;
    if (pendingDisconnects.has(pendingKey)) {
      clearTimeout(pendingDisconnects.get(pendingKey));
      pendingDisconnects.delete(pendingKey);
    }
    socket.join(roomId);

    const room = io.sockets.adapter.rooms.get(roomId);
    const participantCount = room ? room.size : 1;
    socket.emit("call:joined", { roomId, participantCount });
    socket.to(roomId).emit("call:peer-joined", { userId });
  });

  socket.on("call:offer", ({ roomId, offer, fromUserId }) => {
    socket.to(roomId).emit("call:offer", { offer, fromUserId });
  });

  socket.on("call:answer", ({ roomId, answer, fromUserId }) => {
    socket.to(roomId).emit("call:answer", { answer, fromUserId });
  });

  socket.on("call:ice-candidate", ({ roomId, candidate, fromUserId }) => {
    socket.to(roomId).emit("call:ice-candidate", { candidate, fromUserId });
  });

  socket.on("call:leave", ({ roomId, userId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    socket.to(roomId).emit("call:peer-left", { userId });
  });

  socket.on("disconnect", () => {
    const disconnectedUserId = socket.data.userId;
    const disconnectedRoomId = socket.data.roomId;

    if (disconnectedUserId && userSocketMap.get(disconnectedUserId) === socket.id) {
      userSocketMap.delete(disconnectedUserId);
    }
    if (!disconnectedUserId || !disconnectedRoomId) return;

    const pendingKey = `${disconnectedUserId}::${disconnectedRoomId}`;
    const timeout = setTimeout(() => {
      pendingDisconnects.delete(pendingKey);
      if (userSocketMap.has(disconnectedUserId)) return;
      socket.to(disconnectedRoomId).emit("call:peer-left", {
        userId: disconnectedUserId,
      });
    }, 5000);

    pendingDisconnects.set(pendingKey, timeout);
  });
});

server.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

const DBURL = process.env.DB_URL;
if (!DBURL) {
  console.error('Missing DB_URL in server/.env');
  process.exit(1);
}
if (DBURL.includes("<db_password>")) {
  console.error(
    'DB_URL still contains "<db_password>". Replace it with your Atlas DB user password (URL-encode special characters), then restart the server.'
  );
  process.exit(1);
}
mongoose
  .connect(DBURL)
  .then(() => {
    console.log("Mongodb connected");
  })
  .catch((error) => {
    console.log(error);
  });

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("!!! GLOBAL SERVER ERROR !!!");
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  res.status(500).json({ 
    message: "Internal Server Error", 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});
