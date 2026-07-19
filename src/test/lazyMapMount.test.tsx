import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { LazyMapMount } from "@/components/leaflet/LazyMapMount";

describe("LazyMapMount", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("mounts map children once the container intersects the viewport", async () => {
    let observerCallback: IntersectionObserverCallback | null = null;
    const OriginalIntersectionObserver = globalThis.IntersectionObserver;

    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
    } as unknown as typeof IntersectionObserver;

    try {
      render(
        <LazyMapMount style={{ height: 420 }}>
          <div data-testid="map-child">map ready</div>
        </LazyMapMount>,
      );

      expect(screen.queryByTestId("map-child")).toBeNull();
      expect(observerCallback).not.toBeNull();

      await act(async () => {
        observerCallback?.(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      });

      expect(screen.getByTestId("map-child")).toHaveTextContent("map ready");
    } finally {
      globalThis.IntersectionObserver = OriginalIntersectionObserver;
    }
  });
});

