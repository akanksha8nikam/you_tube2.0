import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const videoSchema = new mongoose.Schema({
  videotitle: String,
  filepath: String,
}, { timestamps: true });

const Video = mongoose.model("Video", videoSchema, "videofiles");

async function checkMigration() {
  try {
    const dbUrl = process.env.DB_URL;
    await mongoose.connect(dbUrl);
    
    // Find videos where filepath does NOT start with http
    const localVideos = await Video.find({
      filepath: { $not: /^http/ }
    });

    console.log(`Found ${localVideos.length} local videos in the database.`);
    localVideos.forEach(v => {
      console.log(`- ${v.videotitle} (Path: ${v.filepath})`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMigration();
