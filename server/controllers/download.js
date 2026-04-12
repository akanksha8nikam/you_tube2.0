import mongoose from "mongoose";
import download from "../Modals/download.js";
import users from "../Modals/Auth.js";

const getTodayWindow = () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { startOfDay, endOfDay };
};

export const getDownloadLimitStatus = async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  try {
    const user = await users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const plan = user.subscriptionPlan || "FREE";
    const isPremium = plan !== "FREE";
    const dailyLimit = isPremium ? null : 1;
    const { startOfDay, endOfDay } = getTodayWindow();
    const usedToday = await download.countDocuments({
      viewer: userId,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });
    return res.status(200).json({
      plan,
      dailyLimit,
      usedToday,
      remainingToday: dailyLimit === null ? null : Math.max(0, dailyLimit - usedToday),
      premiumRequired: dailyLimit !== null && usedToday >= dailyLimit,
    });
  } catch (error) {
    console.error("Download status error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const handleDownload = async (req, res) => {
  const { videoId } = req.params;
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(videoId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user or video id" });
  }

  try {
    const user = await users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentPlan = user.subscriptionPlan || "FREE";
    if (currentPlan === "FREE") {
      const { startOfDay, endOfDay } = getTodayWindow();

      const todayDownloads = await download.countDocuments({
        viewer: userId,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      });

      if (todayDownloads >= 1) {
        return res.status(402).json({
          allowed: false,
          message:
            "Free users can download only 1 video per day. Upgrade to Premium for unlimited daily downloads.",
          premiumRequired: true,
          usedToday: todayDownloads,
          dailyLimit: 1,
        });
      }
    }

    const existingDownload = await download.findOne({ viewer: userId, videoid: videoId });
    if (!existingDownload) {
      await download.create({ viewer: userId, videoid: videoId });
    }

    return res.status(200).json({
      allowed: true,
      alreadyDownloaded: Boolean(existingDownload),
      message: existingDownload
        ? "Download allowed."
        : "Download allowed and added to your downloads list.",
    });
  } catch (error) {
    console.error("Download handling error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getAllDownloads = async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  try {
    const downloads = await download
      .find({ viewer: userId })
      .populate({
        path: "videoid",
        model: "videofiles",
      })
      .sort({ createdAt: -1 })
      .exec();

    return res.status(200).json(downloads);
  } catch (error) {
    console.error("Get downloads error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deleteDownload = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid download id" });
  }
  try {
    await download.findByIdAndDelete(id);
    return res.status(200).json({ message: "Download removed successfully" });
  } catch (error) {
    console.error("Delete download error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
