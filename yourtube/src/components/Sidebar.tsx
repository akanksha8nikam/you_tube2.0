import {
  Home,
  Compass,
  PlaySquare,
  Clock,
  ThumbsUp,
  History,
  User, Upload, Video, Download,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { Button } from "./ui/button";
import Channeldialogue from "./channeldialogue";
import { useUser } from "@/lib/AuthContext";

const Sidebar = () => {
  const { user } = useUser();

  const [isdialogeopen, setisdialogeopen] = useState(false);
  return (
    <aside className="hidden md:block w-64 shrink-0 bg-slate-50 border-r min-h-screen p-3 shadow-inner">
      <nav className="space-y-1">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
            <Home className="w-5 h-5 mr-3" />
            Home
          </Button>
        </Link>
        <Link href="/explore">
          <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
            <Compass className="w-5 h-5 mr-3" />
            Explore
          </Button>
        </Link>
        <Link href="/subscriptions">
          <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
            <PlaySquare className="w-5 h-5 mr-3" />
            Subscriptions
          </Button>
        </Link>
        <Link href="/video-call">
          <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
            <Video className="w-5 h-5 mr-3" />
            Video Call
          </Button>
        </Link>

        {user && (
          <>
            <div className="border-t pt-2 mt-2">
              <Link href="/history">
                <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
                  <History className="w-5 h-5 mr-3" />
                  History
                </Button>
              </Link>
              <Link href="/liked">
                <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
                  <ThumbsUp className="w-5 h-5 mr-3" />
                  Liked videos
                </Button>
              </Link>
              <Link href="/watch-later">
                <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
                  <Clock className="w-5 h-5 mr-3" />
                  Watch later
                </Button>
              </Link>
              {user?.channelname ? (
                <Link href={`/channel/${user._id}`}>
                  <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
                    <User className="w-5 h-5 mr-3" />
                    Your channel
                  </Button>
                </Link>
              ) : (
                <div className="px-2 py-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setisdialogeopen(true)}
                  >
                    Create Channel
                  </Button>
                </div>
              )}
              <Link href="/upload">
                <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
                  <Upload className="w-5 h-5 mr-3" />
                  Upload
                </Button>
              </Link>
              <Link href="/downloads">
                <Button variant="ghost" className="w-full justify-start hover:bg-white hover:shadow-sm rounded-lg transition-all">
                  <Download className="w-5 h-5 mr-3" />
                  Downloads
                </Button>
              </Link>
            </div>
          </>
        )}
      </nav>
      <Channeldialogue
        isopen={isdialogeopen}
        onclose={() => setisdialogeopen(false)}
        mode="create"
      />
    </aside>
  );
};

export default Sidebar;
