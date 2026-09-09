import type { types as mediasoupTypes } from "mediasoup";
import { createRouter } from "./mediasoup/router";
import { stringify } from "node:querystring";

export interface Peer {
  id: string;
  displayName: string;
  transports: Map<string, mediasoupTypes.WebRtcTransport>;
  producers: Map<string, mediasoupTypes.Producer>;
  consumers: Map<string, mediasoupTypes.Consumer>;
}

export interface Room {
  id: string;
  router: mediasoupTypes.Router;
  peers: Map<string, Peer>;
}

// currently in-memory, need to separate
const rooms = new Map<string, Room>();

export async function getOrCreateRoom(roomId: string): Promise<Room> {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const router = await createRouter();
  const room: Room = { id: roomId, router, peers: new Map() };
  rooms.set(roomId, room);
  return room;
}

export function addPeer(room: Room, peerId: string, displayName: string): Peer {
  const peer: Peer = {
    id: peerId,
    displayName,
    transports: new Map(),
    producers: new Map(),
    consumers: new Map(),
  };
  room.peers.set(peerId, peer);
  return peer;
}

export function removePeer(room: Room, peerId: string): void {
  const peer = room.peers.get(peerId);
  if (!peer) return;

  for (const consumer of peer.consumers.values()) consumer.close();
  for (const producer of peer.producers.values()) producer.close();
  for (const transport of peer.transports.values()) transport.close();

  room.peers.delete(peerId);

  if (room.peers.size === 0) {
    room.router.close();
    rooms.delete(room.id);
  }
}
