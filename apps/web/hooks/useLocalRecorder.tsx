"use client"

import { addChunk } from "@/lib/recording/chunk-store"
import { drainPendingChunks } from "@/lib/recording/uploader"
import { useCallback, useEffect, useRef, useState } from "react"

const CHUNK_INTERVAL_MS = 3000
const DRAIN_INTERVAL_MS = 5000

type RecordingState = "idle" | "recording" | "stopped"

export function useLocalRecorder(stream: MediaStream | null, sessionId: string) {
  const [state, setState] = useState<RecordingState>("idle")
  const recordeRef = useRef<MediaRecorder | null>(null)
  const chunkIndexRef = useRef(0)
  const drainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(() => {
    if (!stream || recordeRef.current) return

    const mimeType = "video/webm;codecs=vp8,opus"
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined
    })

    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return
      const index = chunkIndexRef.current++
      // fire and forget on purpose: awaiting here would block
      // MediaRecorder's own internal timer thread from producing the
      // chunk on schedule
      void addChunk(sessionId, index, event.data)
    }


    // timeslice is what makes MediaRecorder emit chunks periodically
    // rather than one giant blob at the end; this is the actual mechanism that makes local recording resilient; without it,
    // a crash mid-recording loses the entire session, not
    // just the last few seconds
    recorder.start(CHUNK_INTERVAL_MS)
    recordeRef.current = recorder
    setState("recording")

    drainIntervalRef.current = setInterval(() => {
      void drainPendingChunks(sessionId)
    }, DRAIN_INTERVAL_MS)
  }, [stream, sessionId])

  const stop = useCallback(() => {
    recordeRef.current?.stop()
    recordeRef.current = null
    setState("stopped")

    if (drainIntervalRef.current) {
      clearInterval(drainIntervalRef.current)
      drainIntervalRef.current = null
    }
    // one final drain immediately on stop, rather than waiting for the
    // next interval tick, so the last chunk(s) don't sit around
    // unnecessarliy once the user has explicitly ended the recording
    void drainPendingChunks(sessionId)
  }, [sessionId])

  // without this listern, a chunk stuck in retry-backoff could
  // ssit pending until the next scheduled interval tick, which is
  // a real but much slower recovery path
  useEffect(() => {
    const onOnline = () => void drainPendingChunks(sessionId)
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [sessionId])

  // safety: is the component unmounts while still recoding,
  // this makes sure the recorder and interval are torn down rather
  // than leaking
  useEffect(() => {
    return () => {
      recordeRef.current?.stop()
      if (drainIntervalRef.current) clearInterval(drainIntervalRef.current)
    }
  }, [])

  return { state, start, stop }
}
