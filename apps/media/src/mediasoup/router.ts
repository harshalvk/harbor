import type { types as mediasoupTypes } from "mediasoup";
import { config } from "../config";
import { getNextWorker } from "./workers";

// a router is scoped to one worker and represents one 'room'
export async function createRouter(): Promise<mediasoupTypes.Router> {
  const worker = getNextWorker();
  const router = worker.createRouter({
    mediaCodecs: config.mediasoup.routerMediaCodecs,
  });
  return router;
}
