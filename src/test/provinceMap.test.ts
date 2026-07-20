import { describe, expect, it } from "vitest";
import type { DistrictVelocityPoint } from "@/types/car";
import {
  SL_PROVINCES,
  DISTRICT_TO_PROVINCE,
  getProvinceForDistrict,
  aggregateDistrictVelocityByProvince,
} from "@/lib/provinceMap";

describe("provinceMap", () => {
  it("maps all 25 Sri Lanka districts across 9 provinces", () => {
    expect(SL_PROVINCES).toHaveLength(9);
    expect(Object.keys(DISTRICT_TO_PROVINCE)).toHaveLength(25);

    expect(getProvinceForDistrict("Colombo")).toBe("Western");
    expect(getProvinceForDistrict("nuwara eliya")).toBe("Central");
    expect(getProvinceForDistrict("Kurunegala")).toBe("North Western");
    expect(getProvinceForDistrict("Ratnapura")).toBe("Sabaragamuwa");
    expect(getProvinceForDistrict("Unknown District")).toBeNull();
  });

  it("sums listings and computes listing-weighted average velocity per province", () => {
    const points: DistrictVelocityPoint[] = [
      {
        district: "Colombo",
        lat: 6.9,
        lng: 79.8,
        listing_count: 100,
        new_7d_count: 20,
        velocity_score: 0.2,
      },
      {
        district: "Gampaha",
        lat: 7.1,
        lng: 80.0,
        listing_count: 50,
        new_7d_count: 5,
        velocity_score: 0.1,
      },
      {
        district: "Kandy",
        lat: 7.3,
        lng: 80.6,
        listing_count: 40,
        new_7d_count: 8,
        velocity_score: 0.4,
      },
      {
        district: "NotADistrict",
        lat: 0,
        lng: 0,
        listing_count: 99,
        new_7d_count: 9,
        velocity_score: 0.9,
      },
    ];

    const aggregated = aggregateDistrictVelocityByProvince(points);

    const western = aggregated.find((p) => p.province === "Western");
    const central = aggregated.find((p) => p.province === "Central");

    expect(western).toMatchObject({
      listing_count: 150,
      new_7d_count: 25,
      district_count: 2,
    });
    // (0.2*100 + 0.1*50) / 150 = 0.1666...
    expect(western!.velocity_score).toBeCloseTo(1 / 6, 6);

    expect(central).toMatchObject({
      listing_count: 40,
      new_7d_count: 8,
      velocity_score: 0.4,
      district_count: 1,
    });

    expect(aggregated.every((p) => SL_PROVINCES.includes(p.province))).toBe(true);
    expect(aggregated.some((p) => p.province === "Northern")).toBe(false);
  });

  it("returns empty when no districts map", () => {
    expect(
      aggregateDistrictVelocityByProvince([
        {
          district: "Elsewhere",
          lat: 0,
          lng: 0,
          listing_count: 1,
          new_7d_count: 0,
          velocity_score: 0.1,
        },
      ]),
    ).toEqual([]);
  });
});
