"use client";

import React, { useState } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";
import { Edit2, Check, X } from "lucide-react";

const ChannelHeader = ({ channel, user }: any) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(channel?.channelname || "");
  const [desc, setDesc] = useState(channel?.description || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async () => {
    if (!name.trim()) {
      toast.error("Channel name cannot be empty");
      return;
    }
    setIsLoading(true);
    try {
      await axiosInstance.patch(`/user/update/${user._id}`, {
        channelname: name,
        description: desc,
      });
      toast.success("Channel updated successfully");
      setIsEditing(false);
      window.location.reload();
    } catch (error) {
       toast.error("Failed to update channel");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative h-32 md:h-48 lg:h-64 bg-gradient-to-r from-blue-400 to-purple-500 overflow-hidden"></div>

      {/* Channel Info */}
      <div className="px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Avatar className="w-20 h-20 md:w-32 md:h-32">
            <AvatarFallback className="text-2xl">
              {channel?.channelname[0]}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            {isEditing ? (
              <div className="space-y-4 max-w-xl">
                <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Channel Name</label>
                   <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
                </div>
                <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
                   <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1" />
                </div>
                <div className="flex gap-2">
                   <Button size="sm" onClick={handleUpdate} disabled={isLoading} className="bg-blue-900 hover:bg-blue-950 text-white">
                     <Check className="w-4 h-4 mr-2" /> Save Changes
                   </Button>
                   <Button size="sm" onClick={() => setIsEditing(false)} className="bg-blue-800 hover:bg-blue-900 text-white">
                     <X className="w-4 h-4 mr-2" /> Cancel
                   </Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl md:text-4xl font-bold">{channel?.channelname}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span>@{channel?.channelname.toLowerCase().replace(/\s+/g, "")}</span>
                </div>
                {channel?.description && (
                  <p className="text-sm text-gray-700 max-w-2xl">
                    {channel?.description}
                  </p>
                )}
              </>
            )}
          </div>

          {user && user?._id === channel?._id && !isEditing && (
             <Button onClick={() => setIsEditing(true)} className="bg-blue-900 hover:bg-blue-950 text-white">
               <Edit2 className="w-4 h-4 mr-2" /> Edit Channel
             </Button>
          )}

          {user && user?._id !== channel?._id && (
            <div className="flex gap-2">
              <Button
                onClick={() => setIsSubscribed(!isSubscribed)}
                variant={isSubscribed ? "outline" : "default"}
                className={
                  isSubscribed ? "bg-gray-100" : "bg-red-600 hover:bg-red-700"
                }
              >
                {isSubscribed ? "Subscribed" : "Subscribe"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelHeader;
