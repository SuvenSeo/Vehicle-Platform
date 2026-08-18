import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListingGeoCard } from "@/components/ListingGeoCard";
import type { EnrichmentEnvelope } from "@/services/api";
import { AppPreferencesProvider } from "@/lib/appPreferences";

const AVAILABLE: EnrichmentEnvelope<{
  lat: number;
  lng: number;
  formatted: string;
  result_type: string;
}> = {
  available: true,
  provider: "geoapify",
  market_scope: "Sri Lanka (geocoded ad location)",
  license_note: "Geoapify geocoding. Location text only.",
  fetched_at: "2026-08-18T00:00:00Z",
  match_confidence: 0.92,
  source_url: "https://www.geoapify.com/geocoding-api/",
  limitation:
    "Geocoded from the ad location text. This is not a GPS pin of the individual vehicle.",
  unavailable_reason: null,
  data: {
    lat: 6.917,
    lng: 79.855,
    formatted: "R. A. De Mel Mawatha, Colombo, Sri Lanka",
    result_type: "street",
  },
};

function renderCard(geo: EnrichmentEnvelope | null) {
  return render(
    <AppPreferencesProvider>
      <ListingGeoCard geo={geo} />
    </AppPreferencesProvider>,
  );
}

describe("ListingGeoCard", () => {
  it("shows geocoded address and does not claim a vehicle GPS pin", () => {
    renderCard(AVAILABLE);
    expect(screen.getByText(/R\. A\. De Mel Mawatha/i)).toBeInTheDocument();
    expect(screen.getByText(/not a GPS pin of the individual vehicle/i)).toBeInTheDocument();
    expect(screen.queryByText(/this car is parked at/i)).not.toBeInTheDocument();
  });

  it("renders a quiet unavailable state", () => {
    renderCard({
      ...AVAILABLE,
      available: false,
      data: null,
      match_confidence: null,
      unavailable_reason: "disabled",
      limitation: "Location enrichment is off.",
    });
    expect(screen.getByText(/not available/i)).toBeInTheDocument();
  });
});
