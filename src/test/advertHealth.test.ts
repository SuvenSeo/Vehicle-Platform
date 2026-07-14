import { describe, expect, it } from "vitest";
import { computeAdvertHealth } from "@/lib/advertHealth";

const COMPLETE = {
  thumbnail_url: "https://cdn.example/car.jpg",
  mileage_km: 45_000,
  engine_cc: 1500,
  fuel_type: "hybrid",
  district: "Colombo",
  title: "2019 Toyota Aqua G Grade Hybrid",
  year: 2019,
};

describe("computeAdvertHealth", () => {
  it("scores 100 when all merchandising fields are present", () => {
    const result = computeAdvertHealth(COMPLETE);
    expect(result.score).toBe(100);
    expect(result.band).toBe("strong");
    expect(result.passedCount).toBe(7);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it("scores 0 when nothing is present", () => {
    const result = computeAdvertHealth({});
    expect(result.score).toBe(0);
    expect(result.band).toBe("weak");
    expect(result.passedCount).toBe(0);
  });

  it("counts each checklist factor equally (~14 pts)", () => {
    const onlyYear = computeAdvertHealth({ year: 2020 });
    expect(onlyYear.passedCount).toBe(1);
    expect(onlyYear.score).toBe(Math.round((1 / 7) * 100));

    const withThumb = computeAdvertHealth({
      year: 2020,
      thumbnail_url: "https://cdn.example/x.jpg",
    });
    expect(withThumb.passedCount).toBe(2);
    expect(withThumb.score).toBe(Math.round((2 / 7) * 100));
  });

  it("requires title longer than 10 characters", () => {
    const short = computeAdvertHealth({ ...COMPLETE, title: "Aqua hybrid" });
    // "Aqua hybrid" is 11 chars — need strictly > 10
    expect(short.checks.find((c) => c.key === "title")?.passed).toBe(true);

    const tooShort = computeAdvertHealth({ ...COMPLETE, title: "Aqua" });
    expect(tooShort.checks.find((c) => c.key === "title")?.passed).toBe(false);
    expect(tooShort.score).toBe(Math.round((6 / 7) * 100));
  });

  it("accepts images array as thumbnail presence", () => {
    const result = computeAdvertHealth({
      ...COMPLETE,
      thumbnail_url: null,
      images: ["https://cdn.example/alt.jpg"],
    });
    expect(result.checks.find((c) => c.key === "thumbnail")?.passed).toBe(true);
  });

  it("requires mileage, engine_cc, fuel_type, district, and year", () => {
    const result = computeAdvertHealth({
      title: "A reasonably long listing title",
      thumbnail_url: "https://cdn.example/car.jpg",
    });
    const byKey = Object.fromEntries(result.checks.map((c) => [c.key, c.passed]));
    expect(byKey.thumbnail).toBe(true);
    expect(byKey.title).toBe(true);
    expect(byKey.mileage).toBe(false);
    expect(byKey.engine_cc).toBe(false);
    expect(byKey.fuel_type).toBe(false);
    expect(byKey.district).toBe(false);
    expect(byKey.year).toBe(false);
    expect(result.score).toBe(Math.round((2 / 7) * 100));
  });

  it("treats zero mileage as present and null mileage as missing", () => {
    expect(computeAdvertHealth({ ...COMPLETE, mileage_km: 0 }).checks.find((c) => c.key === "mileage")?.passed).toBe(
      true,
    );
    expect(
      computeAdvertHealth({ ...COMPLETE, mileage_km: null }).checks.find((c) => c.key === "mileage")?.passed,
    ).toBe(false);
  });
});
