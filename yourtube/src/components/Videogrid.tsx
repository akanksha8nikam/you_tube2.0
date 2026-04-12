"use client";

import { useEffect, useState } from "react";
import VideoCard from "./videocard";
import axiosInstance from "@/lib/axiosinstance";
import axios from "axios";

export interface Video {
  _id: string;
  videotitle: string;
  videochanel: string;
  filepath: string;
  views: number;
  createdAt: string;
}

const Videogrid = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setError(null);
        const res = await axiosInstance.get<Video[]>("/video/getall");
        setVideos(res.data);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message || "Failed to load videos");
        } else {
          setError("Unexpected error occurred");
        }
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="bg-gray-200 rounded-lg animate-pulse h-64"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="col-span-full text-center py-8 text-red-500">
        {error}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="col-span-full text-center py-8">
        <p className="text-gray-500">No videos available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {videos.map((video) => (
        <VideoCard key={video._id} video={video} />
      ))}
    </div>
  );
};

export default Videogrid;
