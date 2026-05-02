import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useUser } from "./AuthContext";
import { useRouter } from "next/router";

const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:5000";

type IncomingCall = {
  fromUserId: string;
  roomId: string;
};

interface CallContextType {
  socket: Socket | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser() as { user: any };
  const selfId = user?._id || user?.id || "";
  const router = useRouter();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isIgnored, setIsIgnored] = useState(false);

  // Audio Context refs for ringtone
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillator1Ref = useRef<OscillatorNode | null>(null);
  const oscillator2Ref = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRingtone = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }

      const gainNode = audioCtxRef.current.createGain();
      gainNode.gain.setValueAtTime(0.5, audioCtxRef.current.currentTime);
      gainNode.connect(audioCtxRef.current.destination);
      gainNodeRef.current = gainNode;

      // Create dual tone (400Hz + 450Hz) for ringing sound
      const osc1 = audioCtxRef.current.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(400, audioCtxRef.current.currentTime);
      osc1.connect(gainNode);
      oscillator1Ref.current = osc1;

      const osc2 = audioCtxRef.current.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(450, audioCtxRef.current.currentTime);
      osc2.connect(gainNode);
      oscillator2Ref.current = osc2;

      osc1.start();
      osc2.start();

      let isRinging = true;
      ringIntervalRef.current = setInterval(() => {
        if (!gainNodeRef.current || !audioCtxRef.current) return;
        if (isRinging) {
          gainNodeRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
        } else {
          gainNodeRef.current.gain.setValueAtTime(0.5, audioCtxRef.current.currentTime);
        }
        isRinging = !isRinging;
      }, 1000);
    } catch (e) {
      console.warn("Failed to play ringtone", e);
    }
  };

  const stopRingtone = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (oscillator1Ref.current) {
      try { oscillator1Ref.current.stop(); } catch (e) {}
      oscillator1Ref.current.disconnect();
      oscillator1Ref.current = null;
    }
    if (oscillator2Ref.current) {
      try { oscillator2Ref.current.stop(); } catch (e) {}
      oscillator2Ref.current.disconnect();
      oscillator2Ref.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
  };

  useEffect(() => {
    if (!selfId) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    if (!socket) {
      const newSocket = io(SIGNALING_SERVER_URL, {
        transports: ["websocket", "polling"],
      });
      setSocket(newSocket);

      newSocket.on("connect", () => {
        newSocket.emit("call:register", { userId: selfId });
      });

      newSocket.on("call:incoming", ({ roomId, fromUserId }: IncomingCall) => {
        // If already on the video call page and already in this room, do not show global popup
        if (window.location.pathname === "/video-call" && window.location.search.includes(roomId)) {
          return; 
        }
        setIncomingCall({ roomId, fromUserId });
        setIsIgnored(false);
        startRingtone();
      });

      newSocket.on("call:rejected", ({ fromUserId }) => {
         // Stop ringing if the other person cancelled or rejected
         setIncomingCall((prev) => {
            if (prev && prev.fromUserId === fromUserId) {
               stopRingtone();
               setIsIgnored(false);
               return null;
            }
            return prev;
         });
      });
      
      // If the caller leaves before we answer
      newSocket.on("call:peer-left", () => {
         setIncomingCall((prev) => {
            if (prev) {
               stopRingtone();
               setIsIgnored(false);
               return null;
            }
            return prev;
         });
      });
    }

    return () => {
      // Don't disconnect globally on unmount unless user logs out (handled above)
    };
  }, [selfId, socket, router.pathname, router.query, incomingCall]);

  const acceptCall = () => {
    if (!incomingCall || !selfId) return;
    const { roomId, fromUserId } = incomingCall;
    
    stopRingtone();
    setIncomingCall(null);
    
    router.push({
      pathname: "/video-call",
      query: { action: "accept", roomId, friendId: fromUserId }
    });
  };

  const rejectCall = () => {
    if (!incomingCall || !selfId || !socket) return;
    socket.emit("call:reject", {
      toUserId: incomingCall.fromUserId,
      fromUserId: selfId,
    });
    stopRingtone();
    setIncomingCall(null);
  };

  const ignoreCall = () => {
    stopRingtone();
    setIsIgnored(true);
  };

  return (
    <CallContext.Provider value={{ socket }}>
      {children}

      {incomingCall && !isIgnored && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-background border border-border shadow-2xl rounded-2xl p-6 w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-1">Incoming Call</h2>
            <p className="text-muted-foreground mb-6 text-center">
              <span className="font-semibold text-foreground">{incomingCall.fromUserId}</span> is calling you...
            </p>
            <div className="flex gap-2 w-full mt-2">
              <button
                onClick={ignoreCall}
                className="flex-1 px-3 py-2 rounded-xl bg-gray-500 hover:bg-gray-600 text-white font-medium transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                Ignore
              </button>
              <button
                onClick={rejectCall}
                className="flex-1 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" y1="2" x2="2" y2="22"/></svg>
                Decline
              </button>
              <button
                onClick={acceptCall}
                className="flex-1 px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {incomingCall && isIgnored && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-background border border-border shadow-2xl rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Incoming Call...</p>
              <p className="text-xs text-muted-foreground">{incomingCall.fromUserId}</p>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={rejectCall}
                className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                title="Decline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" y1="2" x2="2" y2="22"/></svg>
              </button>
              <button
                onClick={acceptCall}
                className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
                title="Accept"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
