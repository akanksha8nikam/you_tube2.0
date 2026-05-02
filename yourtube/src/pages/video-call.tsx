import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { useUser } from "@/lib/AuthContext";
import { useCall } from "@/lib/CallContext";
import { useRouter } from "next/router";

const SIGNALING_SERVER_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:5000";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

const getRoomId = (userA: string, userB: string) => [userA, userB].sort().join("__");

type IncomingCall = {
  fromUserId: string;
  roomId: string;
};

export default function VideoCallPage() {
  const { user } = useUser() as { user: any };
  const selfId = user?._id || user?.id || "";

  const { socket } = useCall();
  const router = useRouter();

  const [friendId, setFriendId] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef("");
  const peerUserIdRef = useRef("");
  const isMakingOfferRef = useRef(false);
  const selfIdRef = useRef("");
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const clearPeerConnection = () => {
    iceCandidatesQueueRef.current = [];
    peerRef.current?.close();
    peerRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemoteStreams([]);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(console.error);
      audioCtxRef.current = null;
    }
  };

  const startRecording = () => {
    if (!localVideoRef.current || !remoteVideoRef.current) return;
    const localStream = localStreamRef.current;
    const remoteStream = remoteVideoRef.current.srcObject as MediaStream;

    if (!localStream || !remoteStream) {
      setStatus("Both video streams are required to record.");
      return;
    }

    recordedChunksRef.current = [];

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");

    const drawFrame = () => {
      if (!ctx || document.visibilityState === "hidden") return;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (localVideoRef.current && localVideoRef.current.readyState >= 2) {
        ctx.drawImage(localVideoRef.current, 0, 0, 640, 480);
      }
      if (remoteVideoRef.current && remoteVideoRef.current.readyState >= 2) {
        ctx.drawImage(remoteVideoRef.current, 640, 0, 640, 480);
      }
      animationFrameIdRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const canvasStream = canvas.captureStream(30);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();

      if (localStream.getAudioTracks().length > 0) {
        const localSource = audioCtx.createMediaStreamSource(localStream);
        localSource.connect(dest);
      }

      if (remoteStream.getAudioTracks().length > 0) {
        const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
        remoteSource.connect(dest);
      }

      dest.stream.getAudioTracks().forEach((track) => {
        canvasStream.addTrack(track);
      });
    } catch (e) {
      console.warn("Audio mixing failed:", e);
    }

    const options = { mimeType: "video/webm" };
    let recorder;
    try {
      recorder = new MediaRecorder(canvasStream, options);
    } catch (e) {
      recorder = new MediaRecorder(canvasStream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.style.display = "none";
      a.href = url;
      a.download = `video-call-${new Date().toISOString()}.webm`;
      a.click();
      window.URL.revokeObjectURL(url);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setIsRecording(true);
  };

  const cleanup = (disconnectSocket = false, stopLocalTracks = true) => {
    try { stopRecording(); } catch (e) {}

    if (stopLocalTracks) {
      localStreamRef.current?.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;

      screenStreamRef.current?.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      screenStreamRef.current = null;
      if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = null;
      setIsScreenSharing(false);
    }

    const socket = socketRef.current;
    if (socket && roomRef.current && selfIdRef.current) {
      try {
        socket.emit("call:leave", { roomId: roomRef.current, userId: selfIdRef.current });
        if (peerUserIdRef.current) {
          socket.emit("call:reject", { toUserId: peerUserIdRef.current, fromUserId: selfIdRef.current });
        }
      } catch (e) {}
    }

    clearPeerConnection();

    if (disconnectSocket) {
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    }

    roomRef.current = "";
    peerUserIdRef.current = "";
    setRoomId("");
    setIsInCall(false);
    setStatus("Call ended");
  };

  const ensureLocalMedia = async () => {
    if (localStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      // If cleanup was called while waiting for media, stop tracks immediately
      if (!roomRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      // If a stream was already set by a parallel execution, stop this new one
      if (localStreamRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Local media error:", error);
      throw error;
    }
  };

  const buildPeer = (nextRoomId: string) => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStreamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current as MediaStream);
    });

    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      stream.onremovetrack = () => {
        if (stream.getTracks().length === 0) {
          setRemoteStreams((currentStreams) => currentStreams.filter(s => s.id !== stream.id));
        }
      };

      setRemoteStreams((prev) => {
        if (prev.find((s) => s.id === stream.id)) return prev;
        return [...prev, stream];
      });

      if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
         remoteVideoRef.current.srcObject = stream;
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("call:ice-candidate", {
          roomId: nextRoomId,
          candidate: event.candidate,
          fromUserId: selfIdRef.current,
        });
      }
    };

    peerRef.current = peer;
  };

  useEffect(() => {
    if (!socket) return;
    socketRef.current = socket;

    const handleInviteStatus = ({ ok, reason }: { ok: boolean; reason?: string }) => {
      if (!ok) {
        cleanup(false, true);
        setStatus(reason || "Call could not be started.");
      }
    };

    const handleRejected = ({ fromUserId }: { fromUserId: string }) => {
      cleanup(false, true);
      setStatus(`Call rejected by ${fromUserId}`);
    };

    const handleJoined = ({ participantCount }: { participantCount: number }) => {
      setIsInCall(true);
      setStatus(participantCount > 1 ? "Peer joined, negotiating..." : "Waiting for friend...");
    };

    const handlePeerJoined = () => {
      setStatus("Peer joined.");
    };

    const handleAccepted = async ({ fromUserId, roomId: acceptedRoomId }: { fromUserId: string; roomId: string }) => {
        if (!peerRef.current || !roomRef.current || !socketRef.current) return;
        if (roomRef.current !== acceptedRoomId) return;
        if (isMakingOfferRef.current) return;
        isMakingOfferRef.current = true;
        try {
          const offer = await peerRef.current.createOffer();
          await peerRef.current.setLocalDescription(offer);
          socketRef.current.emit("call:offer", {
            roomId: roomRef.current,
            offer,
            fromUserId: selfIdRef.current,
          });
          setStatus(`Call accepted by ${fromUserId}. Connecting...`);
        } catch (error) {
          console.error("Offer creation failed:", error);
          setStatus("Could not start call negotiation.");
        } finally {
          isMakingOfferRef.current = false;
        }
    };

    const handleOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      if (!peerRef.current || !roomRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        while (iceCandidatesQueueRef.current.length > 0) {
          const candidate = iceCandidatesQueueRef.current.shift();
          if (candidate) {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("call:answer", {
          roomId: roomRef.current,
          answer,
          fromUserId: selfIdRef.current,
        });
        setStatus("In call");
      } catch (error) {
        console.error("Answer creation failed:", error);
        setStatus("Failed to answer call.");
      }
    };

    const handleAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      if (!peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        while (iceCandidatesQueueRef.current.length > 0) {
          const candidate = iceCandidatesQueueRef.current.shift();
          if (candidate) {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
        setStatus("In call");
      } catch (error) {
        console.error("Set answer failed:", error);
        setStatus("Failed to connect call.");
      }
    };

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!peerRef.current) return;
      if (!peerRef.current.remoteDescription) {
        iceCandidatesQueueRef.current.push(candidate);
      } else {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("ICE candidate add failed:", error);
        }
      }
    };

    const handlePeerLeft = () => {
      cleanup(false, true);
      setStatus("Peer left.");
    };

    socket.on("call:invite-status", handleInviteStatus);
    socket.on("call:rejected", handleRejected);
    socket.on("call:joined", handleJoined);
    socket.on("call:peer-joined", handlePeerJoined);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:peer-left", handlePeerLeft);

    return () => {
      socket.off("call:invite-status", handleInviteStatus);
      socket.off("call:rejected", handleRejected);
      socket.off("call:joined", handleJoined);
      socket.off("call:peer-joined", handlePeerJoined);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:peer-left", handlePeerLeft);
      cleanup(false, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    selfIdRef.current = selfId;
    // Auto accept call if query params say so
    if (!selfId || !socket) return;
    if (router.query.action === "accept" && router.query.roomId && router.query.friendId) {
      const friendIdStr = router.query.friendId as string;
      const roomIdStr = router.query.roomId as string;
      
      const doAutoAccept = async () => {
        cleanup(false, false);
        roomRef.current = roomIdStr;
        peerUserIdRef.current = friendIdStr;
        setRoomId(roomIdStr);
        setFriendId(friendIdStr);
        setStatus("Joining call...");
        
        try {
          await ensureLocalMedia();
          buildPeer(roomIdStr);
        } catch (error) {
          console.error("Local media error:", error);
          cleanup(false, true);
          setStatus("Camera/microphone permission is required to accept call.");
          return;
        }
        
        socket.emit("call:join", { roomId: roomIdStr, userId: selfId });
        socket.emit("call:accept", {
          roomId: roomIdStr,
          toUserId: friendIdStr,
          fromUserId: selfId,
        });
        setStatus("Call accepted. Connecting...");
        
        router.replace("/video-call", undefined, { shallow: true });
      };
      
      doAutoAccept();
    }
  }, [router.query, selfId, socket]);

  const renegotiateOffer = async () => {
    if (!peerRef.current || !socketRef.current || !roomRef.current) return;
    if (isMakingOfferRef.current) return;
    isMakingOfferRef.current = true;
    try {
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socketRef.current.emit("call:offer", {
        roomId: roomRef.current,
        offer,
        fromUserId: selfIdRef.current,
      });
    } catch (error) {
      console.error("Renegotiation offer failed:", error);
    } finally {
      isMakingOfferRef.current = false;
    }
  };

  const startScreenShare = async () => {
    if (!peerRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      if (localScreenVideoRef.current) {
        localScreenVideoRef.current.srcObject = stream;
      }
      setIsScreenSharing(true);

      stream.getTracks().forEach((track) => {
        peerRef.current?.addTrack(track, stream);
      });

      renegotiateOffer();
    } catch (error) {
      console.error("Screen sharing failed:", error);
      setStatus("Could not start screen sharing.");
    }
  };

  const stopScreenShare = () => {
    if (!peerRef.current || !screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach((track) => {
      track.stop();
      const sender = peerRef.current?.getSenders().find((s) => s.track === track);
      if (sender) {
        peerRef.current?.removeTrack(sender);
      }
    });

    screenStreamRef.current = null;
    setIsScreenSharing(false);
    if (localScreenVideoRef.current) {
      localScreenVideoRef.current.srcObject = null;
    }
    renegotiateOffer();
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff((prev) => !prev);
  };

  const startCall = async () => {
    if (!selfId) {
      setStatus("Please sign in first.");
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      setStatus("Signaling server not connected yet.");
      return;
    }

    const targetId = friendId.trim();
    if (!targetId) {
      setStatus("Enter friend user ID.");
      return;
    }
    if (targetId === selfId) {
      setStatus("Friend ID cannot be your own ID.");
      return;
    }

    cleanup(false, false);
    setStatus("Ringing...");

    const nextRoomId = getRoomId(selfId, targetId);
    roomRef.current = nextRoomId;
    peerUserIdRef.current = targetId;
    setRoomId(nextRoomId);

    try {
      await ensureLocalMedia();
      buildPeer(nextRoomId);
    } catch (error) {
      console.error("Local media error:", error);
      cleanup(false, true);
      setStatus("Camera/microphone permission is required to place call.");
      return;
    }

    socket.emit("call:join", { roomId: nextRoomId, userId: selfId });
    socket.emit("call:invite", {
      roomId: nextRoomId,
      fromUserId: selfIdRef.current,
      toUserId: targetId,
    });
  };



  return (
    <main className="flex-1 p-4 space-y-4 bg-background text-foreground transition-colors duration-500">
      <h1 className="text-2xl font-semibold">Video Call</h1>
      <p className="text-sm text-muted-foreground">Start a 1:1 call using your friend&apos;s user ID.</p>

      <div className="rounded border border-border p-3 bg-muted/40 text-sm">
        <p>
          <span className="font-medium text-foreground">Your ID:</span> {selfId || "Not signed in"}
        </p>
        <p>
          <span className="font-medium text-foreground">Room:</span> {roomId || "-"}
        </p>
        <p>
          <span className="font-medium text-foreground">Status:</span> {status}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <input
          className="border border-border bg-input/50 px-3 py-2 rounded w-full max-w-md text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          placeholder="Friend user ID"
          value={friendId}
          onChange={(e) => setFriendId(e.target.value)}
        />
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          disabled={isInCall || !friendId.trim()}
          onClick={startCall}
        >
          Start Call
        </button>
        <button
          className="px-4 py-2 rounded bg-gray-700 text-white disabled:opacity-60"
          disabled={!isInCall}
          onClick={() => cleanup(false, true)}
        >
          End Call
        </button>
        {isInCall && (
          <>
            <button
              className={`px-4 py-2 rounded text-white ${
                isRecording ? "bg-red-600 animate-pulse" : "bg-green-600"
              }`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? "Stop Recording" : "Record Session"}
            </button>
            <button
              className={`px-4 py-2 rounded text-white ${
                isScreenSharing ? "bg-red-500" : "bg-purple-600"
              }`}
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            >
              {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
            </button>
            <button
              className={`px-4 py-2 rounded text-white ${
                isMuted ? "bg-red-500" : "bg-gray-600"
              }`}
              onClick={toggleMute}
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <button
              className={`px-4 py-2 rounded text-white ${
                isVideoOff ? "bg-red-500" : "bg-gray-600"
              }`}
              onClick={toggleVideo}
            >
              {isVideoOff ? "Turn Video On" : "Turn Video Off"}
            </button>
          </>
        )}
      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="mb-2 font-medium">You</p>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded border bg-black min-h-[220px]"
          />
          <div style={{ display: isScreenSharing ? "block" : "none" }}>
            <p className="mb-2 font-medium mt-4">Your Screen Share</p>
            <video
              ref={localScreenVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded border bg-black min-h-[220px]"
            />
          </div>
        </div>
        <div>
          <p className="mb-2 font-medium">Friend</p>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ display: remoteStreams.length > 0 ? "none" : "block" }}
            className="w-full rounded border bg-black min-h-[220px]"
          />
          {remoteStreams.length > 0 && remoteStreams.map((stream, idx) => (
             <video
               key={stream.id + "-" + idx}
               ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
               autoPlay
               playsInline
               className={`w-full rounded border bg-black min-h-[220px] ${idx > 0 || remoteStreams.length > 1 ? "mt-4" : ""}`}
             />
          ))}
        </div>
      </div>
    </main>
  );
}
