import video from "../Modals/video.js";
import users from "../Modals/Auth.js";
import mongoose from "mongoose";

export const uploadvideo = async (req, res) => {
  if (req.file === undefined) {
    return res
      .status(404)
      .json({ message: "plz upload a mp4 video file only" });
  } else {
    try {
      const file = new video({
        videotitle: req.body.videotitle,
        filename: req.file.originalname,
        filepath: req.file.path,
        filetype: req.file.mimetype,
        filesize: req.file.size,
        videochanel: req.body.videochanel,
        uploader: req.body.uploader,
        thumbnail: req.body.thumbnail,
        duration: req.body.duration,
      });
      await file.save();
      return res.status(201).json("file uploaded successfully");
    } catch (error) {
      console.error(" error:", error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
};
export const getallvideo = async (req, res) => {
  console.log("getallvideo called");
  try {
    const files = await video.find().sort({ createdAt: -1 });
    return res.status(200).send(files);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deletevideo = async (req, res) => {
  const { id } = req.params;
  const uploader = req.body.uploader || req.query.uploader;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Video unavailable..." });
  }

  try {
    const videoFile = await video.findById(id);
    if (!videoFile) return res.status(404).json({ message: "Video not found" });

    if (uploader && String(videoFile.uploader) !== String(uploader)) {
      return res.status(403).json({ message: "Not allowed to delete this video" });
    }

    await video.findByIdAndDelete(id);
    return res.status(200).json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("Delete video error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const updatevideo = async (req, res) => {
  const { id } = req.params;
  const { videotitle, uploader } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Video unavailable..." });
  }

  try {
    const videoFile = await video.findById(id);
    if (!videoFile) return res.status(404).json({ message: "Video not found" });

    if (uploader && String(videoFile.uploader) !== String(uploader)) {
      return res.status(403).json({ message: "Not allowed to update this video" });
    }

    const updatedVideo = await video.findByIdAndUpdate(
      id,
      { $set: { videotitle: videotitle, duration: req.body.duration } },
      { new: true }
    );
    
    return res.status(200).json(updatedVideo);
  } catch (error) {
    console.error("Update video error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getVideosByChannel = async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Try finding videos by exact ID match
    let query = { uploader: id };

    // 2. If it's a valid ObjectId, we might want to also check for videos 
    // where the uploader name matches the owner of this ID (for data consistency)
    if (mongoose.Types.ObjectId.isValid(id)) {
      const user = await users.findById(id);
      if (user) {
        const orConditions = [{ uploader: id }];
        if (user.name) orConditions.push({ uploader: user.name });
        if (user.channelname) orConditions.push({ uploader: user.channelname });
        
        query = { $or: orConditions };
      }
    }

    const files = await video.find(query).sort({ createdAt: -1 });
    res.status(200).json(files);
  } catch (error) {
    console.error("Fetch channel videos error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};
