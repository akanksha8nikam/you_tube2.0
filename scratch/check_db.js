import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../server/.env") });

const videoSchema = new mongoose.Schema({
  videotitle: String,
  filepath: String,
});

const Video = mongoose.model("Video", videoSchema, "videofiles");

async function dump() {
  try {
    await mongoose.connect(process.env.DB_URL);
    const videos = await Video.find().limit(5).sort({ createdAt: -1 });
    console.log("LAST 5 VIDEOS:");
    videos.forEach(v => {
      console.log(`- Title: ${v.videotitle} | Path: ${v.filepath}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

dump();
