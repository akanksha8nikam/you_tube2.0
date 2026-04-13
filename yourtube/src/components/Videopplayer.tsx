"use client";

import { useRef, useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { Gauge, Maximize, Minimize } from "lucide-react";

interface VideoPlayerProps {
  video: {
    _id: string;
    videotitle: string;
    filepath: string;
    duration?: string;
    uploader?: string;
  };
  onNextVideo?: () => void;
  onOpenComments?: () => void;
}

export default function VideoPlayer({
  video,
  onNextVideo,
  onOpenComments,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();

  const tapStateRef = useRef<
    Record<"left" | "center" | "right", { count: number; timer: ReturnType<typeof setTimeout> | null }>
  >({
    left: { count: 0, timer: null },
    center: { count: 0, timer: null },
    right: { count: 0, timer: null },
  });

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [effect, setEffect] = useState<null | "forward" | "backward">(null);
  const [gestureText, setGestureText] = useState("");


  // subscription state
  const [planName, setPlanName] = useState("");
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [isSubscriptionLoaded, setIsSubscriptionLoaded] = useState(false);
  const [consumedWatchTime, setConsumedWatchTime] = useState(0); 
  const [limitMessage, setLimitMessage] = useState("");

  const videoUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${(video?.filepath || "").replace(/\\/g, "/")}`;
  
  // Calculate how many seconds are left in the daily quota
  const globalRemainingSeconds = 
    isSubscriptionLoaded && maxMinutes !== null 
      ? Math.max(0, (maxMinutes * 60) - consumedWatchTime) 
      : null;
  
  // The limit is now applied to the session duration, not the video timestamp.
  // effectiveTotalSec should always be the full video duration.
  const effectiveTotalSec = duration;

  const enforceLimit = () => {
    const player = videoRef.current;
    if (!player || !isSubscriptionLoaded || maxMinutes === null) return;

    const totalConsumedToday = (consumedWatchTime || 0) + (pendingSyncRef.current || 0);
    const limitSec = maxMinutes * 60;

    if (totalConsumedToday >= limitSec) {
      player.pause();
      setIsPlaying(false);
      setLimitMessage(
          `Your ${planName} plan allows only ${maxMinutes} minutes daily. You have reached your limit.`
      );
    }
  };

  // Accumulator for unsynced watch time
  const pendingSyncRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      // guest users => default FREE plan with 5 mins
      if (!user?._id) {
        setPlanName("FREE");
        setMaxMinutes(5);
        setConsumedWatchTime(0);
        setIsSubscriptionLoaded(true);
        return;
      }

      try {
        const res = await axiosInstance.get(`/subscription/user/${user._id}`);
        setPlanName(res.data?.plan || "FREE");
        const serverMinutes = res.data?.maxMinutes;
        setMaxMinutes(typeof serverMinutes === "number" ? serverMinutes : null);
        setConsumedWatchTime(res.data?.consumedWatchTime || 0);
      } catch (error) {
        console.error("Subscription fetch error, falling back to FREE:", error);
        setPlanName("FREE");
        setMaxMinutes(5);
      } finally {
        setIsSubscriptionLoaded(true);
      }
    };

    fetchSubscription();
  }, [user]);

  // Reliable precise heartbeat
  useEffect(() => {
    if (!isPlaying || !user?._id || maxMinutes === null) {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = Date.now();

    const interval = setInterval(async () => {
      if (!lastTickRef.current) return;
      
      const now = Date.now();
      const deltaMs = now - lastTickRef.current;
      lastTickRef.current = now;

      pendingSyncRef.current += deltaMs / 1000;

      // Sync once we've accumulated 5 seconds
      if (pendingSyncRef.current >= 5) {
        const secondsToSync = Math.floor(pendingSyncRef.current);
        pendingSyncRef.current -= secondsToSync;

        try {
          const syncRes = await axiosInstance.patch("/subscription/update-watch-time", {
            userId: user._id,
            incrementSeconds: secondsToSync
          });
          setConsumedWatchTime(syncRes.data.consumedWatchTime);
        } catch (error) {
          console.error("Watch time sync error:", error);
        }
      }
    }, 1000); // Check every second for precision

    return () => {
      clearInterval(interval);
      lastTickRef.current = null;
    };
  }, [isPlaying, user?._id, maxMinutes]);

  useEffect(() => {
    const player = videoRef.current;
    if (player && videoUrl && isSubscriptionLoaded) {
      player.load();
      
      // Only block if total limit is already reached
      if (maxMinutes !== null && (consumedWatchTime || 0) >= (maxMinutes * 60)) {
        setIsPlaying(false);
        setLimitMessage(
          `Your ${planName} plan allows only ${maxMinutes} minutes daily. You have reached your limit.`
        );
        return;
      }

      player.play().catch(e => console.log("Auto-play prevented:", e));
      setIsPlaying(true);
    }
  }, [videoUrl, isSubscriptionLoaded]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;

    // reset message when video changes
    setLimitMessage("");

    const syncDuration = () => {
      const d = player.duration;
      // duration can be NaN/Infinity/0 while metadata isn't ready
      if (!Number.isFinite(d) || d <= 0) return;
      setDuration(d);
    };

    // If metadata is already available, set duration immediately
    if (player.readyState >= 1) {
      syncDuration();
    }

    const handleTimeUpdate = () => {
      setCurrentTime(player.currentTime);
      enforceLimit();
    };

    const handlePlay = () => {
      setIsPlaying(true);
      enforceLimit();
    };

    const handlePause = () => setIsPlaying(false);

    player.addEventListener("loadedmetadata", syncDuration);
    player.addEventListener("durationchange", syncDuration);
    player.addEventListener("timeupdate", handleTimeUpdate);
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);

    return () => {
      player.removeEventListener("loadedmetadata", syncDuration);
      player.removeEventListener("durationchange", syncDuration);
      player.removeEventListener("timeupdate", handleTimeUpdate);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
    };
  }, [video?._id, globalRemainingSeconds, planName, maxMinutes]);

  // Self-Healing Duration: Sync calculated duration to backend if missing or incorrect
  useEffect(() => {
    if (!duration || !video?._id) return;
    
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    const formattedDuration = `${mins}:${secs.toString().padStart(2, "0")}`;

    // Update if stored duration is missing or significantly different
    if (!video.duration || video.duration !== formattedDuration) {
      const syncToBackend = async () => {
        try {
          await axiosInstance.patch(`/video/update/${video._id}`, {
            duration: formattedDuration,
            uploader: video.uploader || user?._id // Fallback to current user if uploader ID at first is missing or context unknown
          });
          console.log(`Synced duration for ${video._id}: ${formattedDuration}`);
        } catch (error) {
          console.error("Failed to sync video duration:", error);
        }
      };
      
      // Delay slightly to ensure metadata is stable
      const timer = setTimeout(syncToBackend, 2000);
      return () => clearTimeout(timer);
    }
  }, [duration, video?._id, video.duration]);

  const togglePlay = () => {
    const player = videoRef.current;
    if (!player) return;

    if (maxMinutes !== null && (consumedWatchTime + pendingSyncRef.current) >= (maxMinutes * 60)) {
      setLimitMessage(
          `Your ${planName} plan allows only ${maxMinutes} minutes daily. Upgrade to watch more.`
      );
      return;
    }

    if (player.paused) player.play();
    else player.pause();
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const player = videoRef.current;
    if (!player) return;

    let time = Number(e.target.value);

    if (maxMinutes !== null && (consumedWatchTime + pendingSyncRef.current) >= (maxMinutes * 60)) {
      setLimitMessage(`Your ${planName} daily limit has been reached.`);
    }

    player.currentTime = time;
    setCurrentTime(time);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;

    if (!document.fullscreenElement) {
      await container?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const runLeftAction = (tapCount: number) => {
    const player = videoRef.current;
    if (!player) return;

    if (tapCount === 2) {
      player.currentTime = Math.max(0, player.currentTime - 10);
      setEffect("backward");
      setTimeout(() => setEffect(null), 500);
      setGestureText("⏪ -10s");
      setTimeout(() => setGestureText(""), 600);
    } else if (tapCount >= 3) {
      onOpenComments?.();
      setGestureText("💬 Opened comments");
      setTimeout(() => setGestureText(""), 900);
    }
  };

  const runCenterAction = (tapCount: number) => {
    if (tapCount >= 3) {
      if (onNextVideo) {
        onNextVideo();
        setGestureText("⏭ Next video");
      } else {
        setGestureText("No next video available.");
      }
      setTimeout(() => setGestureText(""), 900);
      return;
    }
    togglePlay();
  };

  const runRightAction = (tapCount: number) => {
    const player = videoRef.current;
    if (!player) return;

    if (tapCount === 2) {
      let nextTime = player.currentTime + 10;

      if (maxMinutes !== null && (consumedWatchTime + pendingSyncRef.current) >= (maxMinutes * 60)) {
        setLimitMessage(`Your ${planName} plan allows only ${maxMinutes} minutes daily.`);
      }

      player.currentTime = nextTime;
      setEffect("forward");
      setTimeout(() => setEffect(null), 500);
      setGestureText("⏩ +10s");
      setTimeout(() => setGestureText(""), 600);
    } else if (tapCount >= 3) {
      setGestureText("Closing website...");
      setTimeout(() => setGestureText(""), 800);
      
      try {
        // The most aggressive method to bypass browser security and force-close a tab. 
        // We trick the browser into believing the tab was opened via script by replacing its history.
        window.open("about:blank", "_self");
        window.close();
      } catch (e) {
        console.log("Browser forcefully blocked closure.");
      }
    }
  };

  const handleZoneTap = (zone: "left" | "center" | "right") => {
    const zoneState = tapStateRef.current[zone];
    zoneState.count += 1;

    // Fix: Execute play/pause instantly to bypass mobile Safari/Chrome strict autoplay policy
    if (zone === "center" && zoneState.count === 1) {
      togglePlay();
    }

    if (zoneState.timer) {
      clearTimeout(zoneState.timer);
    }
    zoneState.timer = setTimeout(() => {
      const count = zoneState.count;
      zoneState.count = 0;
      zoneState.timer = null;
      if (zone === "left") runLeftAction(count);
      if (zone === "right") runRightAction(count);
      if (zone === "center" && count >= 3) {
        if (onNextVideo) {
          onNextVideo();
          setGestureText("⏭ Next video");
        } else {
          setGestureText("No next video available.");
        }
        setTimeout(() => setGestureText(""), 900);
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      (["left", "center", "right"] as const).forEach((zone) => {
        const timer = tapStateRef.current[zone].timer;
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const changeSpeed = (speed: number) => {
    const player = videoRef.current;
    if (!player) return;

    player.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  // Speed change wrapper to ensure menu closes or stays open depending on UI choice
  const handleSpeedChange = (speed: number) => {
    changeSpeed(speed);
  };

  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return "0:00";
    const t = Math.floor(time);
    const mins = Math.floor(t / 60);
    const secs = t % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
      <div
          ref={containerRef}
          className="relative aspect-video bg-black rounded-lg overflow-hidden"
      >
        <video
          ref={videoRef}
          className="w-full h-full"
          src={videoUrl}
          playsInline
          disablePictureInPicture
          controlsList="nodownload noplaybackrate nopictureinpicture"
          onContextMenu={(e) => e.preventDefault()}
        />

        {limitMessage && (
            <div className="absolute top-2 left-2 right-2 z-30 bg-red-600 text-white text-xs p-2 rounded">
              {limitMessage}
            </div>
        )}

        <div className="absolute top-2 right-2 z-30 bg-black/70 text-white text-[10px] px-2 py-1 rounded flex flex-col items-end">
          <div>Plan: {planName}</div>
          <div>
            {maxMinutes === null 
              ? "Unlimited" 
              : `${Math.floor(consumedWatchTime / 60)} / ${maxMinutes} mins consumed`}
          </div>
        </div>

        <div className="absolute inset-0 flex z-10 select-none">
          <div className="w-1/3 h-full" onClick={() => handleZoneTap("left")} />
          <div
              className="w-1/3 h-full flex items-center justify-center"
              onClick={() => handleZoneTap("center")}
          >
            {!isPlaying && <span className="text-white text-5xl">▶</span>}
          </div>
          <div className="w-1/3 h-full" onClick={() => handleZoneTap("right")} />
        </div>

        {effect === "forward" && (
            <div className="absolute right-10 top-1/2 text-white text-3xl">⏩ +10s</div>
        )}

        {effect === "backward" && (
            <div className="absolute left-10 top-1/2 text-white text-3xl">⏪ -10s</div>
        )}
        {gestureText && (
          <div className="absolute inset-x-0 top-8 text-center text-white text-sm z-30">
            {gestureText}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 z-20">
          <input
              type="range"
              min={0}
              max={effectiveTotalSec || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full"
          />

          <div className="flex justify-between items-center text-white text-xs mt-1">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay}>{isPlaying ? "⏸" : "▶"}</button>
              <span>
              {formatTime(Math.min(currentTime, effectiveTotalSec || 0))} / {formatTime(effectiveTotalSec)}
            </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                  title="Playback Speed"
                >
                  <Gauge className="w-4 h-4" />
                  <span className="w-8">{playbackSpeed}x</span>
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/10 p-3 rounded-lg shadow-2xl min-w-[180px] z-50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Playback Speed</span>
                      <button onClick={() => setShowSpeedMenu(false)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-1 mb-4">
                      {[0.5, 1, 1.5, 2].map(speed => (
                        <button
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className={`py-1 rounded text-[10px] border transition-all ${
                            playbackSpeed === speed 
                              ? "bg-white text-black border-white" 
                              : "bg-white/5 border-white/10 hover:bg-white/15"
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px]">
                        <span>Fine control</span>
                        <span className="text-blue-400 font-bold">{playbackSpeed}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.25}
                        max={3}
                        step={0.05}
                        value={playbackSpeed}
                        onChange={(e) => handleSpeedChange(Number(e.target.value))}
                        className="w-full accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-gray-500 mt-1">
                        <span>0.25x</span>
                        <span>3.0x</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={toggleFullscreen}
                className="hover:text-blue-400 transition-colors"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}