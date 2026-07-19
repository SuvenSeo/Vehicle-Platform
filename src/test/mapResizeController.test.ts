import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MapResizeController", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/components/leaflet/MapResizeController.tsx"),
    "utf8",
  );

  it("guards ResizeObserver sync against re-entrant Leaflet layout thrash", () => {
    expect(src).toContain("syncing");
    expect(src).toContain("requestAnimationFrame");
    expect(src).toContain("didFitBounds");
  });

  it("does not call fitBounds directly from the ResizeObserver callback", () => {
    // fitBounds must run via the guarded invalidate path, not inline in RO.
    expect(src).toMatch(/ResizeObserver\(\(\)\s*=>\s*\{\s*scheduleInvalidate\(\);/);
    expect(src).not.toMatch(/ResizeObserver\(\(\)\s*=>\s*sync\(\)/);
  });
});
