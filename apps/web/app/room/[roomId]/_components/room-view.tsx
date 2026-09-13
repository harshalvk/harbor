"use client";

import VideoTile from "@/components/video-tile";
import { useRoom } from "@/hooks/useRoom";

interface RoomViewProps {
  roomId: string;
  displayName: string;
}

export function RoomView({ roomId, displayName }: RoomViewProps) {
  const wsUrl = process.env.NEXT_PUBLIC_MEDIA_WS_URL ?? "ws://localhost:4000";
  const { localStream, remotePeers, connectionState } = useRoom(wsUrl, roomId, displayName);

  if (connectionState === "error") {
    return <p>Couldn&apos;t connect to the room. Check that apps/media is running.</p>;
  }
  return (
    <div>
      <p>Status: {connectionState}</p>
      <div className="grid gap-4">
        {localStream && <VideoTile stream={localStream} label={`${displayName} (you)`} muted />}
        {remotePeers.map((peer) => (
          <VideoTile key={peer.peerId} stream={peer.stream} label={peer.peerId} />
        ))}
      </div>
    </div>
  );
}
