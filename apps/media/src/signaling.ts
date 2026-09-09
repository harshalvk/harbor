import {
  clientRequestSchema,
  ServerEvent,
  type ServerResponse,
} from "@harbor/shared";
import { addPeer, getOrCreateRoom, Peer, removePeer, Room } from "./rooms";
import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config";

function send(ws: WebSocket, message: ServerResponse | ServerEvent) {
  ws.send(JSON.stringify(message));
}

function broadcastToRoom(
  room: Room,
  exceptPeerId: string,
  event: ServerEvent,
  socketsByPeer: Map<string, WebSocket>,
) {
  for (const peerId of room.peers.keys()) {
    if (peerId === exceptPeerId) continue;
    const ws = socketsByPeer.get(peerId);
    if (ws) send(ws, event);
  }
}

export function attachSignalingServe(server: Server) {
  const wss = new WebSocketServer({ server });

  const socketsByPeer = new Map<string, WebSocket>();

  wss.on("connection", (ws) => {
    let room: Room | null = null;
    let peer: Peer | null = null;

    ws.on("message", async (raw) => {
      let parsed: ReturnType<typeof clientRequestSchema.parse>;
      try {
        parsed = clientRequestSchema.parse(JSON.parse(raw.toString()));
      } catch (err) {
        console.warn("received invalid signaling message", err);
        return;
      }

      const { requestId, payload } = parsed;

      try {
        switch (payload.type) {
          case "joinRoom": {
            room = await getOrCreateRoom(payload.roomId);
            const peerId = uuidv4();
            peer = addPeer(room, peerId, payload.displayName);
            socketsByPeer.set(peerId, ws);

            send(ws, {
              requestId,
              ok: true,
              data: { peerId, roomId: room.id },
            });
            break;
          }

          case "getRouterRtpCapabilities": {
            if (!room) throw new Error("must joinRoom first");
            send(ws, {
              requestId,
              ok: true,
              data: room.router.rtpCapabilities,
            });
            break;
          }

          case "createWebRtcTransport": {
            if (!room || !peer) throw new Error("must joinRoom first");
            const transport = await room.router.createWebRtcTransport({
              ...config.mediasoup.webRtcTransportOptions,
              appData: { isSend: payload.direction === "send" },
            });
            peer.transports.set(transport.id, transport);

            send(ws, {
              requestId,
              ok: true,
              data: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
              },
            });
            break;
          }

          case "connectTransport": {
            if (!peer) throw new Error("must joinRoom first");
            const transport = peer.transports.get(payload.transportId);
            if (!transport) throw new Error("unknown transportId");
            await transport.connect({
              dtlsParameters: payload.dtlsParameters as any,
            });
            send(ws, { requestId, ok: true, data: null });
            break;
          }

          case "produce": {
            if (!room || !peer) throw new Error("must joinRoom first");
            const transport = peer.transports.get(payload.transportId);
            if (!transport) throw new Error("unknown transportId");

            const producer = await transport.produce({
              kind: payload.kind,
              rtpParameters: payload.rtpParameters as any,
            });
            peer.producers.set(producer.id, producer);

            send(ws, { requestId, ok: true, data: { id: producer.id } });

            broadcastToRoom(
              room,
              peer.id,
              {
                type: "newProducer",
                producerId: producer.id,
                peerId: peer.id,
                kind: payload.kind,
              },
              socketsByPeer,
            );
            break;
          }

          case "consume": {
            if (!room || !peer) throw new Error("must joinRoom first");

            const recvTranport = [...peer.transports.values()].find(
              (t) => !t.appData?.isSend,
            );
            if (!recvTranport) {
              throw new Error(
                "no recv transport - call createWebRtcTransport first",
              );
            }

            const canConsume = room.router.canConsume({
              producerId: payload.producerId,
              rtpCapabilities: payload.rtpCapabilities as any,
            });
            if (!canConsume) {
              throw new Error(
                "cannot consume this producer with given rtpCapabilities",
              );
            }

            const consumer = await recvTranport.consume({
              producerId: payload.producerId,
              rtpCapabilities: payload.rtpCapabilities as any,
              paused: false,
            });
            peer.consumers.set(consumer.id, consumer);

            send(ws, {
              requestId,
              ok: true,
              data: {
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
              },
            });
            break;
          }
        }
      } catch (err) {
        send(ws, {
          requestId,
          ok: false,
          error: err instanceof Error ? err.message : "unknown error",
        });
      }
    });

    ws.on("close", () => {
      if (room && peer) {
        socketsByPeer.delete(peer.id);
        broadcastToRoom(
          room,
          peer.id,
          { type: "peerLeft", peerId: peer.id },
          socketsByPeer,
        );
        removePeer(room, peer.id);
      }
    });
  });

  console.log("signaling: WebSocket server attached");
}
