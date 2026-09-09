"use client";

import { useEffect, useRef, useState } from "react";
import { SignalingClient } from "../lib/signaling-client";
import { Transport } from "mediasoup-client/types";
import { Device } from "mediasoup-client";

export interface RemotePeer {
  peerId: string;
  stream: MediaStream;
}

interface UseRoomResult {
  localStream: MediaStream | null;
  remotePeers: RemotePeer[];
  connectionState: "connecting" | "connected" | "error";
}

export function useRoom(
  wsUrl: string,
  roomId: string,
  displayName: string,
): UseRoomResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [connectionState, setConnectionState] =
    useState<UseRoomResult["connectionState"]>("connecting");

  const signalingRef = useRef<SignalingClient | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTranspoertRef = useRef<Transport | null>(null);

  useEffect(() => {
    let cancelled = false;
    const signaling = new SignalingClient(wsUrl);
    signalingRef.current = signaling;

    async function join() {
      // step 1: join the room
      await signaling.request({ type: "joinRoom", roomId, displayName });

      // step 2: fetch the router's codec capabilities
      const routerRtpCapabilities = await signaling.request({
        type: "getRouterRtpCapabilities",
      });
      const device = new Device();
      await device.load({
        routerRtpCapabilities: routerRtpCapabilities as any,
      });

      // step 3: create the send transport
      const sendTransportInfo = await signaling.request<{
        id: string;
        iceParameters: unknown;
        iceCandidates: unknown;
        dtlsParameters: unknown;
      }>({ type: "createWebRtcTransport", direction: "send" });

      const sendTransport = device.createSendTransport(
        sendTransportInfo as any,
      );
      sendTransportRef.current = sendTransport;

      sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
        signaling
          .request({
            type: "connectTransport",
            transportId: sendTransport.id,
            dtlsParameters,
          })
          .then(() => callback())
          .catch(errback);
      });

      sendTransport.on(
        "produce",
        ({ kind, rtpParameters }, callback, errback) => {
          signaling
            .request<{ id: string }>({
              type: "produce",
              transportId: sendTransport.id,
              kind,
              rtpParameters,
            })
            .then(({ id }) => callback({ id }))
            .catch(errback);
        },
      );

      // step 4: create the recv transport
      const recvTranportInfo = await signaling.request<{
        id: string;
        iceParameters: unknown;
        iceCandidates: unknown;
        dtlsParameters: unknown;
      }>({ type: "createWebRtcTransport", direction: "recv" });

      const recvTranport = device.createRecvTransport(recvTranportInfo as any);
      recvTranspoertRef.current = recvTranport;

      recvTranport.on("connect", ({ dtlsParameters }, callback, errback) => {
        signaling
          .request({
            type: "connectTransport",
            transportId: recvTranport.id,
            dtlsParameters,
          })
          .then(() => callback())
          .catch(errback);
      });

      // step 5: captuer the local camera/mic and produce both tracks
      // through the send transport
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      setLocalStream(stream);

      for (const track of stream.getTracks()) {
        await sendTransport.produce({ track });
      }

      // step 6: react to other peer's media becoming available
      signaling.on("newProducer", async (event) => {
        if (event.type !== "newProducer") return;

        const consumerParams = await signaling.request<{
          id: string;
          producerId: string;
          kind: "audio" | "video";
          rtpParameters: unknown;
        }>({
          type: "consume",
          producerId: event.producerId,
          rtpCapabilities: device.rtpCapabilities as any,
        });

        const consumer = await recvTranport.consume(consumerParams as any);

        setRemotePeers((prev) => {
          const existing = prev.find((p) => p.peerId === event.peerId);
          if (existing) {
            existing.stream.addTrack(consumer.track);
            return [...prev];
          }
          const stream = new MediaStream([consumer.track]);
          return [...prev, { peerId: event.peerId, stream }];
        });
      });

      signaling.on("peerLeft", (event) => {
        if (event.type !== "peerLeft") return;
        setRemotePeers((perv) => perv.filter((p) => p.peerId !== event.peerId));
      });

      if (!cancelled) setConnectionState("connected");
    }

    join().catch((err) => {
      console.error("failed to join room", err);
      if (!cancelled) setConnectionState("error");
    });

    return () => {
      cancelled = true;
      sendTransportRef.current?.close();
      recvTranspoertRef.current?.close();
      signaling.close();
    };
  }, [wsUrl, roomId, displayName]);

  return { localStream, remotePeers, connectionState };
}
