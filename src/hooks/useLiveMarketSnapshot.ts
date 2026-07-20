import { useEffect, useRef, useState } from "react";
import { getLiveMarketSnapshot, getLiveMarketStreamUrl, SNAPSHOT_BASE } from "@/services/api";
import type { LiveMarketSnapshot } from "@/types/car";

const POLL_INTERVAL_MS = 30_000;

let sharedSnapshot: LiveMarketSnapshot | null = null;
const listeners = new Set<(snapshot: LiveMarketSnapshot | null) => void>();
let eventSource: EventSource | null = null;
let pollId: ReturnType<typeof setInterval> | null = null;
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

function startStream() {
  if (eventSource !== null) return;
  if (SNAPSHOT_BASE) {
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
      } catch {
        // Ignore malformed stream frames and wait for the next snapshot.
      }
    });
    eventSource.onerror = () => {
      eventSource?.close();
      eventSource = null;
      startPolling();
    };
  } catch {
    eventSource = null;
    startPolling();
  }
}

function stopStream() {
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
