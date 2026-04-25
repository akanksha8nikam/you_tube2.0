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
    <aside className="hidden md:block w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto p-3 shadow-inner transition-colors duration-500">
      <nav className="space-y-1">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
            <Home className="w-5 h-5 mr-3" />
            <span className="font-medium text-sm">Home</span>
          </Button>
        </Link>
        <Link href="/explore">
          <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
            <Compass className="w-5 h-5 mr-3" />
            <span className="font-medium text-sm">Explore</span>
          </Button>
        </Link>
        <Link href="/subscriptions">
          <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
            <PlaySquare className="w-5 h-5 mr-3" />
            <span className="font-medium text-sm">Subscriptions</span>
          </Button>
        </Link>
        <Link href="/video-call">
          <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
            <Video className="w-5 h-5 mr-3" />
            <span className="font-medium text-sm">Video Call</span>
          </Button>
        </Link>

        {user && (
          <>
            <div className="border-t border-sidebar-border pt-2 mt-2">
              <Link href="/history">
                <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
                  <History className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">History</span>
                </Button>
              </Link>
              <Link href="/liked">
                <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
                  <ThumbsUp className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Liked videos</span>
                </Button>
              </Link>
              <Link href="/watch-later">
                <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
                  <Clock className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Watch later</span>
                </Button>
              </Link>
              {user?.channelname ? (
                <Link href={`/channel/${user._id}`}>
                  <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
                    <User className="w-5 h-5 mr-3" />
                    <span className="font-medium text-sm">Your channel</span>
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
                <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
                  <Upload className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Upload</span>
                </Button>
              </Link>
              <Link href="/downloads">
                <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-all px-3 h-12">
                  <Download className="w-5 h-5 mr-3" />
                  <span className="font-medium text-sm">Downloads</span>
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
