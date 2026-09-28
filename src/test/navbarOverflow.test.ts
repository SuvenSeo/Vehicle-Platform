import { describe, expect, it } from "vitest";
import { computeVisibleTabCount } from "@/lib/navOverflow";

describe("computeVisibleTabCount", () => {
  it("shows all tabs when they fit", () => {
    expect(computeVisibleTabCount([60, 70, 80], 300, 2)).toBe(3);
  });

  it("collapses trailing tabs that overflow", () => {
    // 60 + 2 + 70 = 132 fits in 140; adding 80 + 2 would exceed it.
    expect(computeVisibleTabCount([60, 70, 80], 140, 2)).toBe(2);
  });

  it("always keeps at least one tab visible so the bar never empties", () => {
    expect(computeVisibleTabCount([500, 500], 100, 2)).toBe(1);
  });

  it("handles an empty tab list", () => {
    expect(computeVisibleTabCount([], 300, 2)).toBe(0);
  });

  it("accounts for the gap between tabs", () => {
    // 100 + 2 + 100 = 202 > 200, so only the first tab fits.
    expect(computeVisibleTabCount([100, 100], 200, 2)).toBe(1);
  });

  it("fits exactly at the boundary", () => {
    // 100 + 2 + 100 = 202 fits exactly in 202.
    expect(computeVisibleTabCount([100, 100], 202, 2)).toBe(2);
  });
});
