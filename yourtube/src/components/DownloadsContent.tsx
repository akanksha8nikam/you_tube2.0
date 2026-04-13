"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import { toast } from "sonner";

export default function DownloadsContent() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  const load = async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    try {
      const res = await axiosInstance.get(`/download/${user._id}`);
      setDownloads(res.data || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?._id]);

  const handleDelete = async (downloadId: string) => {
    if (confirm("Remove this video from your downloads?")) {
      try {
        await axiosInstance.delete(`/download/${downloadId}`);
        toast.success("Removed from downloads");
        setDownloads(downloads.filter((d) => d._id !== downloadId));
      } catch (err) {
        toast.error("Failed to remove download");
      }
    }
  };

  if (loading) return <div>Loading downloads...</div>;

  if (!user) {
    return (
      <div className="text-center py-12">
        <Download className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Your Downloads</h2>
        <p className="text-gray-600">Sign in to see downloaded videos.</p>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="text-center py-12">
        <Download className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No downloads yet</h2>
        <p className="text-gray-600">Downloaded videos will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{downloads.length} videos</p>
      <div className="space-y-4">
        {downloads.filter(item => item.videoid).map((item) => (
          <div key={item._id} className="flex flex-col sm:flex-row gap-4 group items-start">
            <Link href={`/watch/${item.videoid?._id}`} className="w-full sm:w-auto flex-shrink-0">
              <div className="relative w-full sm:w-40 md:w-56 aspect-video bg-slate-100 rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300">
                <video
                  src={`/api/proxy/${(item.videoid?.filepath || "").replace(/\\/g, "/")}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out pointer-events-none"
                  disablePictureInPicture
                  controlsList="nodownload noplaybackrate nopictureinpicture"
                  onContextMenu={(e) => e.preventDefault()}
                />
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1.5 rounded shadow-sm">
                  {item.videoid?.duration || (() => {
                    const seed = (item.videoid?._id || "").split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                    const mins = (seed % 10) + 1;
                    const secs = (seed % 60).toString().padStart(2, '0');
                    return `${mins}:${secs}`;
                  })()}
                </div>
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/watch/${item.videoid?._id}`}>
                <h3 className="font-medium text-sm line-clamp-2 group-hover:text-blue-600 mb-1">
                  {item.videoid?.videotitle}
                </h3>
              </Link>
              <p className="text-sm text-gray-600">{item.videoid?.videochanel}</p>
              <p className="text-xs text-gray-500 mt-1">
                Downloaded {formatDistanceToNow(new Date(item.createdAt))} ago
              </p>
            </div>
            <button
              onClick={() => handleDelete(item._id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
              title="Remove Download"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
