"use strict";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "youtube_clone/videos",
    resource_type: "auto",
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
    fieldSize: 20 * 1024 * 1024, // 20 MB for large base64 thumbnails
  }
});

export const uploadsDir = "uploads";
export default upload;
