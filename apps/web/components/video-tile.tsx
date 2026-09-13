"use client";

import { useEffect, useRef } from "react";

interface VideoTileProps {
  stream: MediaStream;
  label: string;
  muted?: boolean;
}

function VideoTile({ stream, label, muted = false }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // srcObject (not the `src` attribute) is how you attach a live
    // MediaStream to a <video> element - this isn't a URL to a file,
    // it's a direct reference to the stream object itself.
    video.srcObject = stream;

    // Cleanup matters here specifically because the *same* MediaStream
    // object gets tracks added to it later (see useRoom's setRemotePeers
    // logic, where a second track is added to an existing peer's stream) -
    // detaching on unmount avoids a video element holding a reference to
    // a stream whose component has gone away.
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div style={{ position: "relative" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: "100%" }}
      />
      <span
        style={{ position: "absolute", bottom: 8, left: 8, color: "white" }}
      >
        {label}
      </span>
    </div>
  );
}

export default VideoTile