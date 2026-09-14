import { getPendingChunks, markUploaded, StoredChunk } from "./chunk-store"

const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

async function uploadChunk(chunk: StoredChunk): Promise<void> {
  const formData = new FormData()
  formData.append("sessionId", chunk.sessionId)
  formData.append("index", String(chunk.index))
  formData.append("blob", chunk.blob)
  
  const response = await fetch("/api/recordings/chunks", {
    method: "POST",
    body: formData
  })
  
  if (!response.ok) {
    throw new Error(`chunk upload failed: ${response.status}`)
  }
}

/*
backoffDelay function waits longer after each success failure
(1s, 2s, 4s, 8s, 16s) rather than hammering a struggling connection at 
a fixed interval; gives a flaky network time to recover instead of
adding to the congestion
*/
function backoffDelay(attempt: number): number {
  return BASE_DELAY_MS * 2 ** attempt
}

async function uploadWithRetry(chunk: StoredChunk): Promise<boolean>{
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++){
    try {
      await uploadChunk(chunk)
      await markUploaded(chunk.id)
      return true
    } catch (err) {
      console.warn(`chunk ${chunk.id} upload attempt ${attempt + 1} failed`, err)
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)))
      }
    }
  }
  return false
}

let draining = false

/*  drainPendingChunks is safe to call repeatedly/concurrently 
(like once on an interval, once on "online" event, once per new chunk) -
the 'draining' flag means overlapping calls just no-op rather thann uploading the same chunks twice in parallel
*/
export async function drainPendingChunks(sessionId: string): Promise<void> {
  if (draining) return
  draining = true
  
  try {
    const pending = await getPendingChunks(sessionId)
    for (const chunk of pending.sort((a, b) => a.index - b.index)) {
      await uploadWithRetry(chunk)
    }
  } finally {
    draining = false
  }
}
