/**
 * WebRTC Video Player — connects to the sidecar via the backend proxy
 * to display a live preview of the video stream in the WebUI.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { musicBotsApi } from '@/api/music.api';

interface VideoPlayerProps {
  botId: number;
  streaming: boolean;
}

export function VideoPlayer({ botId, streaming }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(async () => {
    cleanup();
    setError(null);

    try {
      // Get SDP offer from backend (which gets it from sidecar)
      const { sdp: offerSdp } = await musicBotsApi.webrtcOffer(botId);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      pc.ontrack = (ev) => {
        if (videoRef.current && ev.streams[0]) {
          videoRef.current.srcObject = ev.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'connected') {
          setConnected(true);
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setConnected(false);
        }
      };

      pc.onicecandidate = async (ev) => {
        if (ev.candidate) {
          try {
            await musicBotsApi.webrtcIce(
              botId,
              ev.candidate.candidate,
              ev.candidate.sdpMid || '0',
              ev.candidate.sdpMLineIndex ?? 0
            );
          } catch { /* ignore ICE errors */ }
        }
      };

      // Set remote offer
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp,
      }));

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await musicBotsApi.webrtcAnswer(botId, answer.sdp!);
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      cleanup();
    }
  }, [botId, cleanup]);

  useEffect(() => {
    if (streaming) {
      // Small delay to ensure sidecar is ready
      const timer = setTimeout(connect, 500);
      return () => {
        clearTimeout(timer);
        cleanup();
      };
    } else {
      cleanup();
    }
  }, [streaming, connect, cleanup]);

  if (!streaming) {
    return (
      <div className="flex items-center justify-center bg-black/50 rounded-lg aspect-video max-w-xl">
        <p className="text-muted-foreground text-sm">No active video stream</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-w-xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      {!connected && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-white text-sm animate-pulse">Connecting to stream...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={connect}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      )}
      {connected && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white">LIVE</span>
        </div>
      )}
    </div>
  );
}
