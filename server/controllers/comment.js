import comment from "../Modals/comment.js";
import mongoose from "mongoose";

const allowedCommentRegex = /^[\p{L}\p{N}\p{M}\s.,!?'"-]+$/u;

const containsBlockedCharacters = (text = "") => !allowedCommentRegex.test(text.trim());

export const postcomment = async (req, res) => {
  const { videoid, userid, commentbody, usercommented, city } = req.body;
  if (!commentbody?.trim()) {
    return res.status(400).json({ message: "Comment body is required" });
  }
  if (containsBlockedCharacters(commentbody)) {
    return res.status(400).json({
      message:
        "Comment contains blocked special characters. Use letters, numbers, spaces, and basic punctuation only.",
    });
  }
  const postcomment = new comment({
    videoid,
    userid,
    commentbody: commentbody.trim(),
    usercommented,
    city: city?.trim() || "Unknown",
    likes: [],
    dislikes: [],
  });
  try {
    const savedComment = await postcomment.save();
    return res.status(200).json({ comment: true, data: savedComment });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  try {
    const commentvideo = await comment
      .find({ videoid: videoid })
      .sort({ commentedon: -1, createdAt: -1 });
    const mapped = commentvideo.map((c) => ({
      ...c.toObject(),
      likesCount: c.likes?.length || 0,
      dislikesCount: c.dislikes?.length || 0,
    }));
    return res.status(200).json(mapped);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
export const deletecomment = async (req, res) => {
  const { id: _id } = req.params;
  const { userid } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    const existingComment = await comment.findById(_id);
    if (!existingComment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (userid && String(existingComment.userid) !== String(userid)) {
      return res.status(403).json({ message: "Not allowed to delete this comment" });
    }
    await comment.findByIdAndDelete(_id);
    return res.status(200).json({ comment: true });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const editcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { commentbody, userid, city } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  if (!commentbody?.trim()) {
    return res.status(400).json({ message: "Comment body is required" });
  }
  if (containsBlockedCharacters(commentbody)) {
    return res.status(400).json({
      message:
        "Comment contains blocked special characters. Use letters, numbers, spaces, and basic punctuation only.",
    });
  }
  try {
    const existingComment = await comment.findById(_id);
    if (!existingComment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (userid && String(existingComment.userid) !== String(userid)) {
      return res.status(403).json({ message: "Not allowed to edit this comment" });
    }
    const updatecomment = await comment.findByIdAndUpdate(
      _id,
      {
        $set: {
          commentbody: commentbody.trim(),
          city: city?.trim() || existingComment.city || "Unknown",
        },
      },
      { new: true }
    );
    res.status(200).json({
      ...updatecomment.toObject(),
      likesCount: updatecomment.likes?.length || 0,
      dislikesCount: updatecomment.dislikes?.length || 0,
    });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const reactcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { userId, reaction } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  if (!["like", "dislike"].includes(reaction)) {
    return res.status(400).json({ message: "Invalid reaction" });
  }
  try {
    const foundComment = await comment.findById(_id);
    if (!foundComment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (String(foundComment.userid) === String(userId)) {
      return res.status(400).json({ message: "You cannot react to your own comment" });
    }
    const userIdString = String(userId);
    const likeSet = new Set((foundComment.likes || []).map((id) => String(id)));
    const dislikeSet = new Set((foundComment.dislikes || []).map((id) => String(id)));

    if (reaction === "like") {
      if (likeSet.has(userIdString)) {
        likeSet.delete(userIdString);
      } else {
        likeSet.add(userIdString);
      }
      dislikeSet.delete(userIdString);
    } else {
      if (dislikeSet.has(userIdString)) {
        dislikeSet.delete(userIdString);
      } else {
        dislikeSet.add(userIdString);
      }
      likeSet.delete(userIdString);
    }

    foundComment.likes = Array.from(likeSet);
    foundComment.dislikes = Array.from(dislikeSet);

    if (foundComment.dislikes.length >= 2) {
      await comment.findByIdAndDelete(_id);
      return res.status(200).json({ deleted: true, id: _id });
    }

    await foundComment.save();
    return res.status(200).json({
      deleted: false,
      id: _id,
      likesCount: foundComment.likes.length,
      dislikesCount: foundComment.dislikes.length,
      likes: foundComment.likes,
      dislikes: foundComment.dislikes,
    });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const translatecomment = async (req, res) => {
  const { id: _id } = req.params;
  const { targetLanguage } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "Invalid comment id" });
  }
  if (!targetLanguage?.trim()) {
    return res.status(400).json({ message: "Target language is required" });
  }
  try {
    const foundComment = await comment.findById(_id);
    if (!foundComment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    const target = targetLanguage.trim().toLowerCase();
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        target
      )}&dt=t&q=${encodeURIComponent(foundComment.commentbody)}`
    );
    if (!response.ok) {
      return res.status(200).json({
        translatedText: foundComment.commentbody,
        message: "Translation service unavailable. Showing original text.",
      });
    }
    const data = await response.json();
    const translatedText =
      Array.isArray(data) && Array.isArray(data[0])
        ? data[0].map((item) => item?.[0] || "").join("").trim()
        : "";
    return res.status(200).json({
      translatedText: translatedText || foundComment.commentbody,
    });
  } catch (error) {
    console.error(" error:", error);
    return res.status(200).json({
      translatedText: "",
      message: "Could not translate right now.",
    });
  }
};
