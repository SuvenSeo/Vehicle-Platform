import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("leaflet map bootstrap", () => {
  it("imports Leaflet base CSS so tiles position correctly on the homepage map", () => {
    const mainSrc = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    expect(mainSrc).toContain('import "leaflet/dist/leaflet.css"');
  });

  it("uses LazyMapMount and MapResizeController on the demand velocity map", () => {
    const mapSrc = readFileSync(
      resolve(process.cwd(), "src/components/DistrictVelocityMap.tsx"),
      "utf8",
    );
    expect(mapSrc).toContain("LazyMapMount");
    expect(mapSrc).toContain("MapResizeController");
  });

  it("loads demand velocity widgets through lazyWithRetry", () => {
    const dashboardSrc = readFileSync(
      resolve(process.cwd(), "src/pages/Dashboard.tsx"),
      "utf8",
    );
    expect(dashboardSrc).toContain("lazyWithRetry");
    expect(dashboardSrc).toContain('import("@/components/DistrictVelocityMap")');
    expect(dashboardSrc).not.toMatch(/const DistrictVelocityMap = lazy\(/);
  });
});
