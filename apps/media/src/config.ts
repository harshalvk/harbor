import "dotenv/config";
import os from "node:os";
import { types as mediasoupTypes } from "mediasoup";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mediasoup: {
    numWorkers: os.cpus().length,
    workerSettings: {
      rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) ?? 40000,
      rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) ?? 40100,
    } satisfies Partial<mediasoupTypes.WorkerSettings>,
    routerMediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
        preferredPayloadType: 117,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: { "x-google-start-bitrate": 1000 },
        preferredPayloadType: 96,
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
        },
        preferredPayloadType: 113,
      },
    ] satisfies mediasoupTypes.RtpCodecCapability[],
    webRtcTransportOptions: {
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: process.env.MEDIASOURP_ANNOUNCED_IP ?? "127.0.0.1",
        },
      ],
    } satisfies Partial<mediasoupTypes.WebRtcTransportOptions>,
  },
};
