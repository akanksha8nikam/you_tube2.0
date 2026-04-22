import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cloudinary from "./config/cloudinary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const videoSchema = new mongoose.Schema({
  videotitle: String,
  filepath: String,
  thumbnail: String,
}, { timestamps: true });

const Video = mongoose.model("Video", videoSchema, "videofiles");

async function migrate() {
  try {
    const dbUrl = process.env.DB_URL;
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB for migration...");

    const localVideos = await Video.find({
      filepath: { $not: /^http/ }
    });

    console.log(`Found ${localVideos.length} videos to migrate.\n`);

    for (let video of localVideos) {
      console.log(`Migrating: ${video.videotitle}`);
      
      // 1. Resolve local path
      const localFilePath = path.resolve(__dirname, video.filepath);
      
      if (fs.existsSync(localFilePath)) {
        try {
          console.log(`  Uploading video file: ${video.filepath}...`);
          const videoResult = await cloudinary.uploader.upload(localFilePath, {
            folder: "youtube_clone/videos",
            resource_type: "video"
          });
          
          video.filepath = videoResult.secure_url;
          console.log(`  ✅ Video uploaded: ${videoResult.secure_url}`);

          // 2. Handle thumbnail if it's local
          if (video.thumbnail && !video.thumbnail.startsWith("http") && !video.thumbnail.startsWith("data:")) {
            const localThumbPath = path.resolve(__dirname, video.thumbnail);
            if (fs.existsSync(localThumbPath)) {
              console.log(`  Uploading thumbnail: ${video.thumbnail}...`);
              const thumbResult = await cloudinary.uploader.upload(localThumbPath, {
                folder: "youtube_clone/thumbnails",
                resource_type: "image"
              });
              video.thumbnail = thumbResult.secure_url;
              console.log(`  ✅ Thumbnail uploaded: ${thumbResult.secure_url}`);
            } else {
              console.log(`  ⚠️ Thumbnail file missing locally: ${video.thumbnail}`);
            }
          }

          await video.save();
          console.log(`  ✨ Database updated successfully for "${video.videotitle}"\n`);
        } catch (uploadErr) {
          console.error(`  ❌ Error migrating "${video.videotitle}":`, uploadErr.message);
        }
      } else {
        console.log(`  ❌ Local file not found: ${localFilePath}\n`);
      }
    }

    console.log("Migration finished!");
    process.exit(0);
  } catch (err) {
    console.error("Migration fatal error:", err);
    process.exit(1);
  }
}

migrate();
