import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
  videotitle: String,
  filepath: String,
}, { timestamps: true });

const Video = mongoose.model("Video", videoSchema, "videofiles");

async function check() {
  try {
    const dbUrl = "mongodb://admin:admin@ac-42bc485-shard-00-00.qasxhhv.mongodb.net:27017,ac-42bc485-shard-00-01.qasxhhv.mongodb.net:27017,ac-42bc485-shard-00-02.qasxhhv.mongodb.net:27017/youtube?tls=true&authSource=admin&replicaSet=atlas-9lr4y7-shard-0&retryWrites=true&w=majority";
    await mongoose.connect(dbUrl);
    const videos = await Video.find({ videotitle: /jelly/i }).limit(1);
    if (videos.length === 0) {
      console.log("No video found with title 'jelly'");
    } else {
      console.log("Found Video:");
      console.log("- Title:", videos[0].videotitle);
      console.log("- Path:", videos[0].filepath);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
