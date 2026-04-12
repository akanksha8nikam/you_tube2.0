import ChannelHeader from "@/components/ChannelHeader";
import Channeltabs from "@/components/Channeltabs";
import ChannelVideos from "@/components/ChannelVideos";
import VideoUploader from "@/components/VideoUploader";
import { useUser } from "@/lib/AuthContext";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";

const index = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user: currentUser } = useUser();
  const [channel, setChannel] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch if id is available and NOT the literal string "[id]" (Next.js placeholder)
    if (!id || id === "[id]" || id === "undefined") {
      if (id === "undefined" || id === "[id]") {
        setLoading(false);
        setChannel(null);
      }
      return;
    }

    const fetchChannelData = async () => {
      try {
        setLoading(true);
        // Fetch channel user details
        const channelRes = await axiosInstance.get(`/user/${id}`);
        if (channelRes.data?.result) {
          setChannel(channelRes.data.result);

          // Fetch channel videos
          const videosRes = await axiosInstance.get(`/video/channel/${id}`);
          setVideos(videosRes.data || []);
        } else {
          setChannel(null);
        }
      } catch (error: any) {
        console.error("Error fetching channel data:", error);
        setChannel(null);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Channel not found
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-white">
      <div className="max-w-full mx-auto">
        <ChannelHeader channel={channel} user={currentUser} />
        <Channeltabs />
        
        {/* Only show uploader to the channel owner */}
        {currentUser?._id === id && (
          <div className="px-4 pb-8">
            <VideoUploader channelId={id} channelName={channel?.channelname} />
          </div>
        )}

        <div className="px-4 pb-8">
          <ChannelVideos videos={videos} />
        </div>
      </div>
    </div>
  );
};

export default index;
