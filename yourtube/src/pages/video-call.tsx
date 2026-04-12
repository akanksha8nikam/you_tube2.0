import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useUser } from "@/lib/AuthContext";

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

  const [friendId, setFriendId] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
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
    stopRecording();
    const socket = socketRef.current;
    if (socket && roomRef.current && selfIdRef.current) {
      socket.emit("call:leave", { roomId: roomRef.current, userId: selfIdRef.current });
    }

    clearPeerConnection();

    if (disconnectSocket) {
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    }

    if (stopLocalTracks) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;

      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = null;
      setIsScreenSharing(false);
    }

    roomRef.current = "";
    peerUserIdRef.current = "";
    setRoomId("");
    setIsInCall(false);
    setIncomingCall(null);
    setStatus("Call ended");
  };

  const ensureLocalMedia = async () => {
    if (localStreamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
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
    if (socketRef.current) return;

    const socket = io(SIGNALING_SERVER_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (selfIdRef.current) {
        socket.emit("call:register", { userId: selfIdRef.current });
      }
      if (roomRef.current && selfIdRef.current) {
        socket.emit("call:join", { roomId: roomRef.current, userId: selfIdRef.current });
      }
    });

    socket.on("disconnect", (reason) => {
      if (roomRef.current) {
        setStatus(`Connection lost (${reason}). Reconnecting...`);
      }
    });

    socket.on("call:incoming", ({ roomId: incomingRoomId, fromUserId }: IncomingCall) => {
      setIncomingCall({ roomId: incomingRoomId, fromUserId });
      setStatus(`Incoming call from ${fromUserId}`);
    });

    socket.on("call:invite-status", ({ ok, reason }: { ok: boolean; reason?: string }) => {
      if (!ok) {
        cleanup(false, true);
        setStatus(reason || "Call could not be started.");
      }
    });

    socket.on("call:rejected", ({ fromUserId }: { fromUserId: string }) => {
      cleanup(false, true);
      setStatus(`Call rejected by ${fromUserId}`);
    });

    socket.on("call:joined", ({ participantCount }: { participantCount: number }) => {
      setIsInCall(true);
      setStatus(participantCount > 1 ? "Peer joined, negotiating..." : "Waiting for friend...");
    });

    socket.on("call:peer-joined", () => {
      setStatus("Peer joined.");
    });

    socket.on(
      "call:accepted",
      async ({ fromUserId, roomId: acceptedRoomId }: { fromUserId: string; roomId: string }) => {
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
      }
    );

    socket.on("call:offer", async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
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
    });

    socket.on("call:answer", async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
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
    });

    socket.on("call:ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
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
    });

    socket.on("call:peer-left", () => {
      cleanup(false, true);
      setStatus("Peer left.");
    });

    return () => cleanup(true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    selfIdRef.current = selfId;
    if (!selfId || !socketRef.current) return;
    if (socketRef.current.connected) {
      socketRef.current.emit("call:register", { userId: selfId });
    }
  }, [selfId]);

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

  const acceptCall = async () => {
    if (!selfId || !incomingCall || !socketRef.current) return;

    cleanup(false, false);

    roomRef.current = incomingCall.roomId;
    peerUserIdRef.current = incomingCall.fromUserId;
    setRoomId(incomingCall.roomId);
    setFriendId(incomingCall.fromUserId);
    setIncomingCall(null);
    setStatus("Joining call...");

    try {
      await ensureLocalMedia();
      buildPeer(incomingCall.roomId);
    } catch (error) {
      console.error("Local media error:", error);
      cleanup(false, true);
      setStatus("Camera/microphone permission is required to accept call.");
      return;
    }
    socketRef.current.emit("call:join", { roomId: incomingCall.roomId, userId: selfId });
    socketRef.current.emit("call:accept", {
      roomId: incomingCall.roomId,
      toUserId: incomingCall.fromUserId,
      fromUserId: selfIdRef.current,
    });
    setStatus("Call accepted. Connecting...");
  };

  const rejectCall = () => {
    if (!selfId || !incomingCall || !socketRef.current) return;
    socketRef.current.emit("call:reject", {
      toUserId: incomingCall.fromUserId,
      fromUserId: selfIdRef.current,
    });
    setStatus("Incoming call declined.");
    setIncomingCall(null);
  };

  return (
    <main className="flex-1 p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Video Call</h1>
      <p className="text-sm text-gray-600">Start a 1:1 call using your friend&apos;s user ID.</p>

      <div className="rounded border p-3 bg-gray-50 text-sm">
        <p>
          <span className="font-medium">Your ID:</span> {selfId || "Not signed in"}
        </p>
        <p>
          <span className="font-medium">Room:</span> {roomId || "-"}
        </p>
        <p>
          <span className="font-medium">Status:</span> {status}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <input
          className="border px-3 py-2 rounded w-full max-w-md"
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

      {incomingCall && (
        <div className="rounded border border-green-300 bg-green-50 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p className="text-sm">
            Incoming call from <span className="font-medium">{incomingCall.fromUserId}</span>
          </p>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded bg-green-600 text-white"
              onClick={acceptCall}
            >
              Accept
            </button>
            <button
              className="px-4 py-2 rounded bg-red-600 text-white"
              onClick={rejectCall}
            >
              Reject
            </button>
          </div>
        </div>
      )}

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
