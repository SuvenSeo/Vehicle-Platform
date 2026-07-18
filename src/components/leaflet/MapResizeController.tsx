import { useEffect } from "react";
import { useMap } from "react-leaflet";

type Bounds = [[number, number], [number, number]];

interface MapResizeControllerProps {
  bounds: Bounds;
  padding?: [number, number];
}

/**
 * Keeps Leaflet in sync when the map mounts inside lazy-loaded or scroll-revealed
 * sections whose layout settles after first paint.
 */
export function MapResizeController({ bounds, padding = [18, 18] }: MapResizeControllerProps) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const sync = () => {
      map.invalidateSize({ animate: false, pan: false });
      map.fitBounds(bounds, { padding, animate: false });
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
  }, [map, bounds, padding]);

  return null;
}
