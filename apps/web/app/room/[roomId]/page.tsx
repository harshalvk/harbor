"use client";

import { useState } from "react";
import { use } from "react";
import { RoomView } from "./_components/room-view";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params);

  const [displayName, setDisplayName] = useState("");
  const [joined, setJoined] = useState(false);

  if (joined) {
    return <RoomView roomId={roomId} displayName={displayName} />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (displayName.trim()) setJoined(true);
      }}
    >
      <label>
        Your name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <button type="submit">Join room</button>
    </form>
  );
}
