import { useEffect } from "react";
import { useMap } from "react-leaflet";

type Bounds = [[number, number], [number, number]];

interface MapResizeControllerProps {
  bounds: Bounds;
  padding?: [number, number];
}

const DEFAULT_PADDING: [number, number] = [18, 18];

/**
 * Keeps Leaflet in sync when the map mounts inside lazy-loaded or scroll-revealed
 * sections whose layout settles after first paint.
 *
 * Important: never call fitBounds from ResizeObserver — invalidateSize/fitBounds can
 * resize the container and re-enter the observer, which surfaces as
 * "Maximum call stack size exceeded" in production.
 */
export function MapResizeController({
  bounds,
  padding = DEFAULT_PADDING,
}: MapResizeControllerProps) {
  const map = useMap();
  const padX = padding[0];
  const padY = padding[1];

  useEffect(() => {
    const container = map.getContainer();
    const resolvedPadding: [number, number] = [padX, padY];
    let rafId = 0;
    let syncing = false;
    let didFitBounds = false;

    const fitOnce = () => {
      if (didFitBounds) return;
      const { clientWidth, clientHeight } = container;
      if (clientWidth < 2 || clientHeight < 2) return;
      map.fitBounds(bounds, { padding: resolvedPadding, animate: false });
      didFitBounds = true;
    };

    const invalidate = () => {
      if (syncing) return;
      syncing = true;
      try {
        map.invalidateSize({ animate: false, pan: false });
        fitOnce();
      } finally {
        // Release on the next frame so nested RO callbacks from invalidateSize
        // collapse into a single pass instead of recursing.
        rafId = window.requestAnimationFrame(() => {
          syncing = false;
        });
      }
    };

    const scheduleInvalidate = () => {
      if (syncing) return;
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(invalidate);
    };

    invalidate();
    const timeouts = [80, 250].map((ms) => window.setTimeout(invalidate, ms));

    const resizeObserver = new ResizeObserver(() => {
      scheduleInvalidate();
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) scheduleInvalidate();
      },
      { threshold: 0.05, rootMargin: "80px 0px" },
    );
    intersectionObserver.observe(container);

    window.addEventListener("resize", scheduleInvalidate);

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("resize", scheduleInvalidate);
    };
  }, [map, bounds, padX, padY]);

  return null;
}
