"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "./ui/avatar";
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
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { getVideoUrl } from "@/lib/utils";

const videos = "/video/vdo.mp4";
export default function VideoCard({ video }: any) {
  const { user } = useUser();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(video?.videotitle || "");
  const [newDescription, setNewDescription] = useState(video?.description || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleRename = async () => {
    if (!newTitle.trim()) {
      toast.error("Title cannot be empty");
      return;
    }
    setIsUpdating(true);
    try {
      await axiosInstance.patch(`/video/update/${video._id}`, {
        videotitle: newTitle,
        description: newDescription,
        uploader: user._id,
      });
      toast.success("Video updated successfully");
      setIsRenaming(false);
      window.location.reload();
    } catch (err) {
      toast.error("Failed to update video");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="group relative transition-all duration-300 hover:-translate-y-1">
      <Link href={`/watch/${video?._id}`} className="block space-y-3">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-sm group-hover:shadow-lg transition-all duration-300">
          {video?.thumbnail ? (
            <img
              src={getVideoUrl(video.thumbnail)}
              alt={video.videotitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out pointer-events-none"
            />
          ) : (
            <video
              src={getVideoUrl(video?.filepath || "")}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out pointer-events-none"
              disablePictureInPicture
              controlsList="nodownload noplaybackrate nopictureinpicture"
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-medium px-1.5 py-0.5 rounded shadow-sm backdrop-blur-[2px]">
            {video?.duration || (() => {
              const seed = (video?._id || "").split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
              const mins = (seed % 12) + 1;
              const secs = (seed % 60).toString().padStart(2, '0');
              return `${mins}:${secs}`;
            })()}
          </div>
        </div>

        <div className="flex gap-3">
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarFallback>
              {video?.videochanel?.[0] ?? "U"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[15px] leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {video?.videotitle}
            </h3>

            <p className="text-[13px] text-muted-foreground mt-1.5 font-medium hover:text-foreground transition-colors">
              {video?.videochanel}
            </p>

            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[13px] text-muted-foreground">
                {video?.views?.toLocaleString() ?? 0} views •{" "}
                {video?.createdAt
                  ? formatDistanceToNow(new Date(video.createdAt), {
                      addSuffix: true,
                    })
                  : "just now"}
              </p>
              
              {user?._id === video?.uploader && (
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsRenaming(true);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded transition-all"
                    title="Rename Video"
                  >
                    <Pencil className="w-4 h-4" />
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
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                    title="Delete Video"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
      
      <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter new title"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Add a description"
                className="w-full min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              onClick={handleRename}
              disabled={isUpdating}
              className="bg-blue-900 hover:bg-blue-950 text-white flex-1"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
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
    </div>
  );
}
