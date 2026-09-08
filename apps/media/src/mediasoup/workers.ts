import * as mediasoup from "mediasoup";
import type { types as mediasoupTypes } from "mediasoup";
import { config } from "../config";

const workers: mediasoupTypes.Worker[] = [];
let nextWorkerIndex = 0;

export async function createWorkers(): Promise<void> {
  for (let i = 0; i < config.mediasoup.numWorkers; i++) {
    const worker = await mediasoup.createWorker(
      config.mediasoup.workerSettings,
    );

    worker.on("died", () => {
      console.error(`mediasoup worker ${worker.pid} died, existing`);
      process.exit(1);
    });

    workers.push(worker);
  }

  console.log(`mediasoup: started ${workers.length} worker(s)`);
}

// round-robins
export function getNextWorker(): mediasoupTypes.Worker {
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}
