import {
  clientRequestPayloadSchema,
  serverResponseSchema,
  serverEventSchema,
  type ClientRequestPayload,
  type ServerEvent,
} from "@harbor/shared";

type PendingRequest = {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
};

export class SignalingClient {
  private ws: WebSocket;
  private pending = new Map<string, PendingRequest>();
  private eventListeners = new Map<
    ServerEvent["type"],
    Set<(event: ServerEvent) => void>
  >();
  private readyPromise: Promise<void>;

  constructor(url: string) {
    this.ws = new WebSocket(url);

    this.readyPromise = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener(
        "error",
        () => reject(new Error("WebSocket connection failed")),
        {
          once: true,
        },
      );
    });

    this.ws.addEventListener("message", (raw) => this.handleMessage(raw.data));
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("received non-JSON signaling message");
      return;
    }

    const responseResult = serverResponseSchema.safeParse(parsed);
    if (responseResult.success) {
      const response = responseResult.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;

      this.pending.delete(response.requestId);
      if (response.ok) {
        pending.resolve(response.data);
      } else {
        pending.reject(new Error(response.error));
      }
      return;
    }

    const eventResult = serverEventSchema.safeParse(parsed);
    if (eventResult.success) {
      const event = eventResult.data;
      const listeners = this.eventListeners.get(event.type);
      listeners?.forEach((listener) => listener(event));
      return;
    }

    console.warn(
      "received signaling message matching neither response nor event sceham",
      parsed,
    );
  }

  async waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  async request<T = unknown>(payload: ClientRequestPayload): Promise<T> {
    await this.waitUntilReady();
    clientRequestPayloadSchema.parse(payload);

    const requestId = crypto.randomUUID();

    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: resolve as (data: unknown) => void,
        reject,
      });
      this.ws.send(JSON.stringify({ requestId, payload }));
    });
  }

  on(
    eventType: ServerEvent["type"],
    listener: (event: ServerEvent) => void,
  ): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);

    return () => this.eventListeners.get(eventType)?.delete(listener);
  }

  close() {
    this.ws.close();
  }
}
