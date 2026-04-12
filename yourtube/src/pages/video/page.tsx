"use client";

import { useEffect, useRef } from "react";
import io from "socket.io-client";

const SERVER_URL = "http://192.168.1.10:5000"; // 🔥 CHANGE THIS

export default function VideoCall() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const socketRef = useRef<any>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const ROOM_ID = "room1";

  useEffect(() => {
    const init = async () => {
      socketRef.current = io(SERVER_URL);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerRef.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Add tracks
      stream.getTracks().forEach((track) => {
        peerRef.current?.addTrack(track, stream);
      });

      // Receive remote stream
      peerRef.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Send ICE candidates
      peerRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit("ice-candidate", {
            candidate: event.candidate,
            roomId: ROOM_ID,
          });
        }
      };

      // Join room
      socketRef.current.emit("join-room", ROOM_ID);

      // When second user joins → create offer
      socketRef.current.on("user-joined", async () => {
        const offer = await peerRef.current?.createOffer();
        await peerRef.current?.setLocalDescription(offer);

        socketRef.current.emit("offer", {
          offer,
          roomId: ROOM_ID,
        });
      });

      // Receive offer
      socketRef.current.on("offer", async (offer: any) => {
        await peerRef.current?.setRemoteDescription(offer);

        const answer = await peerRef.current?.createAnswer();
        await peerRef.current?.setLocalDescription(answer);

        socketRef.current.emit("answer", {
          answer,
          roomId: ROOM_ID,
        });
      });

      // Receive answer
      socketRef.current.on("answer", async (answer: any) => {
        await peerRef.current?.setRemoteDescription(answer);
      });

      // Receive ICE
      socketRef.current.on("ice-candidate", async (candidate: any) => {
        try {
          await peerRef.current?.addIceCandidate(candidate);
        } catch (err) {
          console.error("ICE error", err);
        }
      });
    };

    init();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>WiFi Video Call</h1>

      <div style={{ display: "flex", gap: 20 }}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "300px", border: "1px solid black" }}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: "300px", border: "1px solid black" }}
        />
      </div>
    </div>
  );
}