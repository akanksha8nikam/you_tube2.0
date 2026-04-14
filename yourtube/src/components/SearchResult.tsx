"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
const SearchResult = ({ query }: any) => {
  const { user } = useUser();
  const [isRenaming, setIsRenaming] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleRename = async () => {
    if (!newTitle.trim() || !selectedVideo) {
      toast.error("Title cannot be empty");
      return;
    }
    setIsUpdating(true);
    try {
      await axiosInstance.patch(`/video/update/${selectedVideo._id}`, {
        videotitle: newTitle,
        uploader: user._id,
      });
      toast.success("Video title updated");
      setIsRenaming(false);
      window.location.reload();
    } catch (err) {
      toast.error("Failed to rename video");
    } finally {
      setIsUpdating(false);
    }
  };

  const openRenameDialog = (v: any) => {
    setSelectedVideo(v);
    setNewTitle(v.videotitle);
    setIsRenaming(true);
  };

  if (!query.trim()) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          Enter a search term to find videos and channels.
        </p>
      </div>
    );
  }
  const [video, setvideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        // Fetch all videos from backend
        const res = await axiosInstance.get("/video/getall");
        const allVideos = res.data;
        
        // Filter videos based on the search query
        const results = allVideos.filter(
          (vid: any) =>
            vid.videotitle.toLowerCase().includes(query.toLowerCase()) ||
            vid.videochanel.toLowerCase().includes(query.toLowerCase())
        );
        setvideos(results);
      } catch (err) {
        console.error("Error searching videos:", err);
      } finally {
        setLoading(false);
      }
    };

    if (query) {
      fetchVideos();
    }
  }, [query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (!video || video.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No results found</h2>
        <p className="text-gray-600">
          Try different keywords or remove search filters
        </p>
      </div>
    );
  }
  const hasResults = video ? video.length > 0 : true;
  if (!hasResults) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No results found</h2>
        <p className="text-gray-600">
          Try different keywords or remove search filters
        </p>
      </div>
    );
  }
  const vids = "/video/vdo.mp4";
  return (
    <div className="space-y-6">
      {/* Video Results */}
      {video.length > 0 && (
        <div className="space-y-4">
          {video.map((video: any) => (
            <div key={video._id} className="flex gap-4 group">
              <Link href={`/watch/${video._id}`} className="flex-shrink-0">
                <div className="relative w-80 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.videotitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <video
                      src={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${(video?.filepath || "").replace(/\\/g, "/")}`}
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      disablePictureInPicture
                      controlsList="nodownload noplaybackrate nopictureinpicture"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm">
                    {video?.duration || (() => {
                      const seed = (video?._id || "").split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                      const mins = (seed % 12) + 1;
                      const secs = (seed % 60).toString().padStart(2, '0');
                      return `${mins}:${secs}`;
                    })()}
                  </div>
                </div>
              </Link>

              <div className="flex-1 min-w-0 py-1">
                <Link href={`/watch/${video._id}`}>
                  <h3 className="font-medium text-lg line-clamp-2 group-hover:text-blue-600 mb-2">
                    {video.videotitle}
                  </h3>
                </Link>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{video.views.toLocaleString()} views</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(video.createdAt))} ago
                    </span>
                  </div>

                  {user?._id === video.uploader && (
                    <div className="flex gap-3 relative z-10">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openRenameDialog(video);
                        }}
                        className="flex items-center gap-1.5 text-xs text-blue-900 hover:text-blue-950 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this video?")) {
                            try {
                              await axiosInstance.delete(`/video/delete/${video._id}?uploader=${user._id}`, {
                                data: { uploader: user._id }
                              });
                              toast.success("Video deleted");
                              window.location.reload();
                            } catch (err) {
                              toast.error("Failed to delete video");
                            }
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Video</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter new title"
              className="w-full"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              onClick={handleRename}
              disabled={isUpdating}
              className="bg-blue-900 hover:bg-blue-950 text-white flex-1"
            >
              {isUpdating ? "Saving..." : "Save Title"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsRenaming(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load More Results */}
      {hasResults && (
        <div className="text-center py-8">
          <p className="text-gray-600">
            Showing {video.length} results for "{query}"
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchResult;
