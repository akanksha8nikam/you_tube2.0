"use client";

import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Clock,
  Download,
  MoreHorizontal,
  Share,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { useRouter } from "next/router";

interface Video {
  _id: string;
  videotitle: string;
  videochanel: string;
  filepath: string;
  views: number;
  Like: number;
  Dislike: number;
  createdAt: string;
}

const VideoInfo = ({ video }: { video: Video }) => {
  const { user } = useUser();
  const router = useRouter();

  const [likes, setLikes] = useState(video?.Like || 0);
  const [dislikes, setDislikes] = useState(video?.Dislike || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("Download");
  const [downloadUsageText, setDownloadUsageText] = useState("");

  // Update state when video changes
  useEffect(() => {
    if (!video) return;

    setLikes(video.Like || 0);
    setDislikes(video.Dislike || 0);
    setIsLiked(false);
    setIsDisliked(false);
  }, [video]);

  // Add view
  useEffect(() => {
    if (!video?._id) return;

    const handleViews = async () => {
      try {
        if (user) {
          await axiosInstance.post(`/history/${video._id}`, {
            userId: user?._id,
          });
        } else {
          await axiosInstance.post(`/history/views/${video._id}`);
        }
      } catch (error) {
        console.log("View error:", error);
      }
    };

    handleViews();
  }, [user, video]);

  useEffect(() => {
    const loadDownloadStatus = async () => {
      if (!user?._id) {
        setDownloadUsageText("Free users: 1 download/day");
        return;
      }
      try {
        const res = await axiosInstance.get(`/download/limit/${user._id}`);
        const data = res.data;
        if (data.dailyLimit === null) {
          setDownloadUsageText(`${data.plan} plan: unlimited downloads/day`);
        } else {
          setDownloadUsageText(
            `${data.plan} plan: ${data.usedToday}/${data.dailyLimit} used today`
          );
        }
      } catch (error) {
        setDownloadUsageText("Free users: 1 download/day");
      }
    };
    loadDownloadStatus();
  }, [user?._id]);

  const handleLike = async () => {
    if (!user) return;

    try {
      const res = await axiosInstance.post(`/like/${video._id}`, {
        userId: user?._id,
      });

      if (res.data.liked) {
        if (isLiked) {
          setLikes((prev) => prev - 1);
          setIsLiked(false);
        } else {
          setLikes((prev) => prev + 1);
          setIsLiked(true);

          if (isDisliked) {
            setDislikes((prev) => prev - 1);
            setIsDisliked(false);
          }
        }
      }
    } catch (error) {
      console.log("Like error:", error);
    }
  };

  const handleDislike = async () => {
    if (!user) return;

    try {
      const res = await axiosInstance.post(`/like/${video._id}`, {
        userId: user?._id,
      });

      if (!res.data.liked) {
        if (isDisliked) {
          setDislikes((prev) => prev - 1);
          setIsDisliked(false);
        } else {
          setDislikes((prev) => prev + 1);
          setIsDisliked(true);

          if (isLiked) {
            setLikes((prev) => prev - 1);
            setIsLiked(false);
          }
        }
      }
    } catch (error) {
      console.log("Dislike error:", error);
    }
  };

  const handleWatchLater = async () => {
    if (!user) return;

    try {
      const res = await axiosInstance.post(`/watch/${video._id}`, {
        userId: user?._id,
      });

      if (res.data.watchlater) {
        setIsWatchLater(!isWatchLater);
      } else {
        setIsWatchLater(false);
      }
    } catch (error) {
      console.log("Watch later error:", error);
    }
  };

  const handleDownload = async () => {
    if (!user?._id) {
      setDownloadLabel("Sign in required");
      setTimeout(() => setDownloadLabel("Download"), 1200);
      return;
    }

    try {
      const gateRes = await axiosInstance.post(`/download/${video._id}`, {
        userId: user._id,
      });
      if (!gateRes.data?.allowed) {
        setDownloadLabel("Premium required");
        if (gateRes.data?.premiumRequired) router.push("/subscriptions");
        setTimeout(() => setDownloadLabel("Download"), 1500);
        return;
      }
      if (user?._id) {
        const statusRes = await axiosInstance.get(`/download/limit/${user._id}`);
        const data = statusRes.data;
        if (data.dailyLimit === null) {
          setDownloadUsageText(`${data.plan} plan: unlimited downloads/day`);
        } else {
          setDownloadUsageText(
            `${data.plan} plan: ${data.usedToday}/${data.dailyLimit} used today`
          );
        }
      }
    } catch (error: any) {
      const premiumRequired = error?.response?.data?.premiumRequired;
      setDownloadLabel(premiumRequired ? "Premium required" : "Failed");
      if (premiumRequired) router.push("/subscriptions");
      setTimeout(() => setDownloadLabel("Download"), 1500);
      return;
    }

    try {
      setDownloadLabel("Downloading...");
      const videoUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${(video?.filepath || "").replace(/\\/g, "/")}`;
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${video.videotitle || "video"}.mp4`;
      a.click();
      window.URL.revokeObjectURL(url);
      setDownloadLabel("Downloaded");
      setTimeout(() => setDownloadLabel("Download"), 1200);
    } catch (error) {
      setDownloadLabel("Failed");
      setTimeout(() => setDownloadLabel("Download"), 1200);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{video?.videotitle}</h1>

      <div className="flex items-center justify-between">
        {/* Channel Info */}
        <div className="flex items-center gap-4">
          <Avatar className="w-10 h-10">
            <AvatarFallback>
              {video?.videochanel?.charAt(0) || "C"}
            </AvatarFallback>
          </Avatar>

          <div>
            <h3 className="font-medium">{video?.videochanel}</h3>
          </div>

          <Button className="ml-4">Subscribe</Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-full">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-l-full"
              onClick={handleLike}
            >
              <ThumbsUp
                className={`w-5 h-5 mr-2 ${
                  isLiked ? "fill-black text-black" : ""
                }`}
              />
              {likes.toLocaleString()}
            </Button>

            <div className="w-px h-6 bg-gray-300" />

            <Button
              variant="ghost"
              size="sm"
              className="rounded-r-full"
              onClick={handleDislike}
            >
              <ThumbsDown
                className={`w-5 h-5 mr-2 ${
                  isDisliked ? "fill-black text-black" : ""
                }`}
              />
              {dislikes.toLocaleString()}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={`bg-gray-100 rounded-full ${
              isWatchLater ? "text-primary" : ""
            }`}
            onClick={handleWatchLater}
          >
            <Clock className="w-5 h-5 mr-2" />
            {isWatchLater ? "Saved" : "Watch Later"}
          </Button>

          <Button variant="ghost" size="sm" className="bg-gray-100 rounded-full">
            <Share className="w-5 h-5 mr-2" />
            Share
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="bg-gray-100 rounded-full"
            onClick={handleDownload}
          >
            <Download className="w-5 h-5 mr-2" />
            {downloadLabel}
          </Button>

          <Button variant="ghost" size="icon" className="bg-gray-100 rounded-full">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
      {downloadUsageText && (
        <p className="text-xs text-gray-600">{downloadUsageText}</p>
      )}

      {/* Description */}
      <div className="bg-gray-100 rounded-lg p-4">
        <div className="flex gap-4 text-sm font-medium mb-2">
          <span>{video?.views?.toLocaleString()} views</span>
          <span>
            {video?.createdAt
              ? formatDistanceToNow(new Date(video.createdAt)) + " ago"
              : ""}
          </span>
        </div>

        <div className={`text-sm ${showFullDescription ? "" : "line-clamp-3"}`}>
          <p>
            Sample video description. This would contain the actual video
            description from the database.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 p-0 h-auto font-medium"
          onClick={() => setShowFullDescription(!showFullDescription)}
        >
          {showFullDescription ? "Show less" : "Show more"}
        </Button>
      </div>
    </div>
  );
};

export default VideoInfo;