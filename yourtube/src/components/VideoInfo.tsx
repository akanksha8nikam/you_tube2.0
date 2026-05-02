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
import { getVideoUrl } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Zap } from "lucide-react";

interface Video {
  _id: string;
  videotitle: string;
  videochanel: string;
  filepath: string;
  views: number;
  Like: number;
  Dislike: number;
  createdAt: string;
  description?: string;
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
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [limitType, setLimitType] = useState<"download" | "premium">("download");

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
        setLimitType(gateRes.data?.premiumRequired ? "premium" : "download");
        setIsLimitDialogOpen(true);
        setDownloadLabel("Limit Reached");
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
      if (premiumRequired) {
        setLimitType("premium");
        setIsLimitDialogOpen(true);
      }
      setDownloadLabel(premiumRequired ? "Premium required" : "Failed");
      setTimeout(() => setDownloadLabel("Download"), 1500);
      return;
    }

    try {
      setDownloadLabel("Downloading...");
      const videoUrl = getVideoUrl(video?.filepath || "");
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

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/60 rounded-full">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-l-full"
              onClick={handleLike}
            >
              <ThumbsUp
                className={`w-5 h-5 mr-2 ${
                  isLiked ? "fill-foreground text-foreground" : ""
                }`}
              />
              {likes.toLocaleString()}
            </Button>

            <div className="w-px h-6 bg-border" />

            <Button
              variant="ghost"
              size="sm"
              className="rounded-r-full"
              onClick={handleDislike}
            >
              <ThumbsDown
                className={`w-5 h-5 mr-2 ${
                  isDisliked ? "fill-foreground text-foreground" : ""
                }`}
              />
              {dislikes.toLocaleString()}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={`bg-muted/60 rounded-full ${
              isWatchLater ? "text-primary" : ""
            }`}
            onClick={handleWatchLater}
          >
            <Clock className="w-5 h-5 mr-2" />
            {isWatchLater ? "Saved" : "Watch Later"}
          </Button>

          <Button variant="ghost" size="sm" className="bg-muted/60 rounded-full">
            <Share className="w-5 h-5 mr-2" />
            Share
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`rounded-full transition-all duration-300 bg-blue-700 hover:bg-blue-800 text-white shadow-md ${
              user?.subscriptionPlan !== "FREE" 
              ? "shadow-blue-500/30" 
              : ""
            }`}
            onClick={handleDownload}
          >
            <Download className={`w-5 h-5 mr-2 ${user?.subscriptionPlan !== "FREE" ? "animate-bounce" : ""}`} />
            {downloadLabel}
          </Button>

          <Button variant="ghost" size="icon" className="bg-muted/60 rounded-full">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {downloadUsageText && (
        <p className={`text-xs font-medium mt-1 ${user?.subscriptionPlan === "FREE" ? "text-muted-foreground" : "text-indigo-400"}`}>
          {user?.subscriptionPlan !== "FREE" && <Zap className="w-3 h-3 inline mr-1" />}
          {downloadUsageText}
        </p>
      )}

      {/* Limit Dialog */}
      <Dialog open={isLimitDialogOpen} onOpenChange={setIsLimitDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              {limitType === "premium" ? "Premium Feature" : "Daily Limit Reached"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-2 text-base">
              {limitType === "premium" 
                ? "Downloading videos is a premium feature. Upgrade your plan to unlock high-quality offline viewing!"
                : "You've reached your daily download limit for your current plan. Upgrade to a higher tier for more downloads!"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
              <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-2">What you can do next:</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5" />
                  Upgrade to <span className="text-white font-medium">Silver or Gold</span> for up to unlimited downloads.
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5" />
                  Enjoy ad-free experience and higher watch time limits.
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsLimitDialogOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Maybe Later
            </Button>
            <Button 
              onClick={() => {
                setIsLimitDialogOpen(false);
                router.push("/subscriptions");
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 shadow-lg shadow-indigo-600/20"
            >
              Upgrade Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Description */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border">
        <div className="flex gap-4 text-sm font-medium mb-2 text-foreground">
          <span>{video?.views?.toLocaleString()} views</span>
          <span>
            {video?.createdAt
              ? formatDistanceToNow(new Date(video.createdAt)) + " ago"
              : ""}
          </span>
        </div>

        <div className={`text-sm text-muted-foreground ${showFullDescription ? "" : "line-clamp-3"}`}>
          <p className="whitespace-pre-wrap">
            {video?.description && video.description.trim() !== "" 
              ? video.description 
              : "No description provided."}
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