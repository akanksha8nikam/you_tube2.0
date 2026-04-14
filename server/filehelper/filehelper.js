"use strict";
import multer from "multer";
import path from "path";
import fs from "fs";

export const uploadsDir = "uploads";

const storage = multer.diskStorage({
  destination: (req, res, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      new Date().toISOString().replace(/:/g, "-") + "-" + file.originalname
    );
  },
});
const filefilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};
const upload = multer({ 
  storage: storage, 
  fileFilter: filefilter,
  limits: {
    fieldSize: 10 * 1024 * 1024, // 10 MB for base64 thumbnails
  }
});
export default upload;
