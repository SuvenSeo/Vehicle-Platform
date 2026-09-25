import { useEffect, useRef, useState } from "react";
import { getLiveMarketSnapshot, getLiveMarketStreamUrl, SNAPSHOT_BASE, SNAPSHOT_ONLY } from "@/services/api";
import type { LiveMarketSnapshot } from "@/types/car";

const POLL_INTERVAL_MS = 60_000;
// Backoff for re-establishing the SSE stream after a transient error. The
// stream used to be abandoned on the first failure, permanently downgrading
// the session to 60s polling even though the connection had recovered.
const RECONNECT_BASE_MS = 15_000;
const RECONNECT_MAX_MS = 120_000;

let sharedSnapshot: LiveMarketSnapshot | null = null;
const listeners = new Set<(snapshot: LiveMarketSnapshot | null) => void>();
let eventSource: EventSource | null = null;
let pollId: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let subscriberCount = 0;

function notifyAll(snapshot: LiveMarketSnapshot | null) {
  sharedSnapshot = snapshot;
  listeners.forEach((listener) => listener(snapshot));
}

function startPolling() {
  if (pollId !== null) return;
  getLiveMarketSnapshot().then(notifyAll).catch(() => {});
  pollId = setInterval(() => {
    getLiveMarketSnapshot().then(notifyAll).catch(() => {});
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollId !== null) {
    clearInterval(pollId);
    pollId = null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

/** Retry the stream with capped exponential backoff while subscribers remain. */
function scheduleStreamReconnect() {
  if (reconnectTimer !== null) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempts, RECONNECT_MAX_MS);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (subscriberCount > 0 && eventSource === null) {
      startStream();
    }
  }, delay);
}

function startStream() {
  if (eventSource !== null) return;
  // Never open SSE against the live API when CDN snapshots are configured
  // (or snapshot-only mode is on) — SSE rebuilds hit Postgres every few seconds.
  if (SNAPSHOT_BASE || SNAPSHOT_ONLY) {
    startPolling();
    return;
  }
  if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
    startPolling();
    return;
  }

  try {
    eventSource = new EventSource(getLiveMarketStreamUrl());
    eventSource.addEventListener("snapshot", (event) => {
      try {
        notifyAll(JSON.parse((event as MessageEvent).data) as LiveMarketSnapshot);
        // A healthy frame supersedes the polling fallback and any pending backoff.
        reconnectAttempts = 0;
        clearReconnectTimer();
        stopPolling();
      } catch {
        // Ignore malformed stream frames and wait for the next snapshot.
      }
    });
    eventSource.onerror = () => {
      eventSource?.close();
      eventSource = null;
      // Keep data flowing via polling while the stream is down, but don't give
      // up on it — without the retry the session stayed on polling forever.
      startPolling();
      scheduleStreamReconnect();
    };
  } catch {
    eventSource = null;
    startPolling();
    scheduleStreamReconnect();
  }
}

function stopStream() {
  clearReconnectTimer();
  reconnectAttempts = 0;
  eventSource?.close();
  eventSource = null;
  stopPolling();
}

export function useLiveMarketSnapshot(): LiveMarketSnapshot | null {
  const [snapshot, setSnapshot] = useState<LiveMarketSnapshot | null>(sharedSnapshot);
  const setterRef = useRef(setSnapshot);
  setterRef.current = setSnapshot;

  useEffect(() => {
    subscriberCount += 1;
    const listener = (next: LiveMarketSnapshot | null) => setterRef.current(next);
    listeners.add(listener);

    if (subscriberCount === 1) {
      startStream();
    } else if (sharedSnapshot) {
      setterRef.current(sharedSnapshot);
    }

    return () => {
      listeners.delete(listener);
      subscriberCount -= 1;
      if (subscriberCount === 0) {
        stopStream();
        sharedSnapshot = null;
      }
    };
  }, []);

  return snapshot;
}
