import { useEffect, useRef, useState } from "react";
import { getPipelineStatus } from "@/services/api";
import type { PipelineStatusResponse } from "@/types/car";

const POLL_INTERVAL_MS = 45_000;

let sharedStatus: PipelineStatusResponse | null = null;
const listeners = new Set<(s: PipelineStatusResponse | null) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let subscriberCount = 0;

function notifyAll(status: PipelineStatusResponse | null) {
  sharedStatus = status;
  listeners.forEach((fn) => fn(status));
}

function startPolling() {
  getPipelineStatus().then(notifyAll).catch(() => {});
  intervalId = setInterval(() => {
    getPipelineStatus().then(notifyAll).catch(() => {});
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function usePipelineStatus(): PipelineStatusResponse | null {
  const [status, setStatus] = useState<PipelineStatusResponse | null>(sharedStatus);
  const setterRef = useRef(setStatus);
  setterRef.current = setStatus;

  useEffect(() => {
    subscriberCount += 1;

    const listener = (s: PipelineStatusResponse | null) => {
      setterRef.current(s);
    };

    listeners.add(listener);

    if (subscriberCount === 1) {
      startPolling();
    } else if (sharedStatus) {
      setterRef.current(sharedStatus);
    }

    return () => {
      listeners.delete(listener);
      subscriberCount -= 1;
      if (subscriberCount === 0) {
        stopPolling();
        sharedStatus = null;
      }
    };
  }, []);

  return status;
}
