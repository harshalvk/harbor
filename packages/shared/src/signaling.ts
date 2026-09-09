import { z } from "zod";

const mediasoupParams = z.record(z.string(), z.unknown());

export const joinRoomSchema = z.object({
  type: z.literal("joinRoom"),
  roomId: z.string(),
  displayName: z.string().min(1).max(100),
});

export const getRouterRtpCapabilitiesSchema = z.object({
  type: z.literal("getRouterRtpCapabilities"),
});

export const createWebRtcTransportSchema = z.object({
  type: z.literal("createWebRtcTransport"),
  direction: z.enum(["send", "recv"]),
});

export const connectTransportSchema = z.object({
  type: z.literal("connectTransport"),
  transportId: z.string(),
  dtlsParameters: mediasoupParams,
});

export const produceSchema = z.object({
  type: z.literal("produce"),
  transportId: z.string(),
  kind: z.enum(["audio", "video"]),
  rtpParameters: mediasoupParams,
});

export const consumeSchema = z.object({
  type: z.literal("consume"),
  producerId: z.string(),
  rtpCapabilities: mediasoupParams,
});

export const clientRequestPayloadSchema = z.discriminatedUnion("type", [
  joinRoomSchema,
  getRouterRtpCapabilitiesSchema,
  createWebRtcTransportSchema,
  connectTransportSchema,
  produceSchema,
  consumeSchema,
]);

export type ClientRequestPayload = z.infer<typeof clientRequestPayloadSchema>;

export const clientRequestSchema = z.object({
  requestId: z.string(),
  payload: clientRequestPayloadSchema,
});

export type ClientRequest = z.infer<typeof clientRequestSchema>;

export const serverResponseSchema = z.union([
  z.object({
    requestId: z.string(),
    ok: z.literal(true),
    data: z.unknown(),
  }),
  z.object({
    requestId: z.string(),
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export type ServerResponse = z.infer<typeof serverResponseSchema>;

export const serverEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("newProducer"),
    producerId: z.string(),
    peerId: z.string(),
    kind: z.enum(["audio", "video"]),
  }),
  z.object({
    type: z.literal("peerLeft"),
    peerId: z.string(),
  }),
]);

export type ServerEvent = z.infer<typeof serverEventSchema>;
