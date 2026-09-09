import http from "http";
import { config } from "./config";
import express from "express";
import type { Application, Response } from "express";
import { createWorkers } from "./mediasoup/workers";
import { attachSignalingServe } from "./signaling";

async function main() {
  await createWorkers();

  const app: Application = express();

  app.get("/healthz", (_req, res: Response) => {
    res.json({ status: "ok" });
  });

  // used http.createServer instead of app.listen coz signaling websocker server
  // needs to attach
  const server = http.createServer(app);

  attachSignalingServe(server);

  server.listen(config.port, () => {
    console.log(`media service listening on : ${config.port}`);
  });
}

main().catch((err) => {
  console.error("failed to start media service", err);
  process.exit(1);
});
