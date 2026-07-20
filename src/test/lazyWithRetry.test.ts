import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "@/lib/lazyWithRetry";

describe("lazyWithRetry chunk detection", () => {
  it("detects common dynamic import failures", () => {
    expect(isChunkLoadError(new Error("Loading chunk 12 failed"))).toBe(true);
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Something else"))).toBe(false);
  });
});
