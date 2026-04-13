import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";

interface RelatedVideosProps {
  videos: Array<{
    _id: string;
    videotitle: string;
    videochanel: string;
    views: number;
    createdAt: string;
    videoUrl: string;
  }>;
}

export default function RelatedVideos({ videos }: RelatedVideosProps) {
  return (
    <div className="space-y-2">
      {videos?.map((video: any) => (
        <Link
          key={video._id}
          href={`/watch/${video._id}`}
          className="flex gap-2 group"
        >
          <div className="relative w-40 aspect-video bg-gray-100 rounded overflow-hidden flex-shrink-0">
            <video
              src={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${(video?.filepath || "").replace(/\\/g, "/")}`}
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              disablePictureInPicture
              controlsList="nodownload noplaybackrate nopictureinpicture"
              onContextMenu={(e) => e.preventDefault()}
            />
            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1.5 rounded shadow-sm">
              {video?.duration || (() => {
                const seed = (video?._id || "").split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                const mins = (seed % 10) + 1;
                const secs = (seed % 60).toString().padStart(2, '0');
                return `${mins}:${secs}`;
              })()}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm line-clamp-2 group-hover:text-blue-600">
              {video.videotitle}
            </h3>
            <p className="text-xs text-gray-600 mt-1">{video.videochanel}</p>
            <p className="text-xs text-gray-600">
              {video.views?.toLocaleString() ?? 0} views •{" "}
              {video.createdAt 
                ? formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })
                : "just now"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
