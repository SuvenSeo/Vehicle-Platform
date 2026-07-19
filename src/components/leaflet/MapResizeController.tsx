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

    const sync = () => {
      map.invalidateSize({ animate: false, pan: false });
      map.fitBounds(bounds, { padding: resolvedPadding, animate: false });
    };

    sync();

    const timeouts = [50, 150, 400, 800].map((ms) => window.setTimeout(sync, ms));
    const resizeObserver = new ResizeObserver(() => sync());
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) sync();
      },
      { threshold: 0.05, rootMargin: "80px 0px" },
    );
    intersectionObserver.observe(container);

    window.addEventListener("resize", sync);

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [map, bounds, padX, padY]);

  return null;
}
