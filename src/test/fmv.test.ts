import { describe, expect, it } from "vitest";
import { summarizeFmv } from "@/lib/fmv";

describe("summarizeFmv", () => {
  it("labels below-market asks", () => {
    const s = summarizeFmv(4_500_000, 5_000_000);
    expect(s?.band).toBe("below");
    expect(s?.label).toMatch(/below FMV/i);
  });

  it("labels overpriced asks", () => {
    const s = summarizeFmv(6_000_000, 5_000_000);
    expect(s?.band).toBe("above");
    expect(s?.label).toMatch(/Overpriced/i);
  });

  it("returns null for missing inputs", () => {
    expect(summarizeFmv(0, 5_000_000)).toBeNull();
    expect(summarizeFmv(5_000_000, 0)).toBeNull();
  });
});
