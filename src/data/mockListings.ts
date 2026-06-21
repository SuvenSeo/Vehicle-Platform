import { CarListing } from "@/types/car";

const makes = ["Toyota", "Honda", "Suzuki", "Nissan", "Mitsubishi", "Hyundai", "Kia", "BMW", "Mercedes-Benz", "Mazda"];
const models: Record<string, { model: string; body: string; fuel: string; cc: number }[]> = {
  Toyota: [
    { model: "Aqua", body: "hatchback", fuel: "hybrid", cc: 1500 },
    { model: "Prius", body: "sedan", fuel: "hybrid", cc: 1800 },
    { model: "Corolla Axio", body: "sedan", fuel: "petrol", cc: 1500 },
    { model: "Vitz", body: "hatchback", fuel: "petrol", cc: 1300 },
    { model: "CHR", body: "suv", fuel: "hybrid", cc: 1800 },
    { model: "RAV4", body: "suv", fuel: "hybrid", cc: 2500 },
    { model: "Hilux", body: "pickup", fuel: "diesel", cc: 2800 },
    { model: "Land Cruiser", body: "suv", fuel: "diesel", cc: 4500 },
    { model: "Allion", body: "sedan", fuel: "petrol", cc: 1500 },
    { model: "Premio", body: "sedan", fuel: "petrol", cc: 1800 },
  ],
  Honda: [
    { model: "Vezel", body: "suv", fuel: "hybrid", cc: 1500 },
    { model: "Fit", body: "hatchback", fuel: "petrol", cc: 1300 },
    { model: "Grace", body: "sedan", fuel: "hybrid", cc: 1500 },
    { model: "CRV", body: "suv", fuel: "petrol", cc: 2000 },
    { model: "Civic", body: "sedan", fuel: "petrol", cc: 1800 },
  ],
  Suzuki: [
    { model: "Alto", body: "hatchback", fuel: "petrol", cc: 660 },
    { model: "Swift", body: "hatchback", fuel: "petrol", cc: 1200 },
    { model: "Wagon R", body: "hatchback", fuel: "petrol", cc: 660 },
    { model: "Vitara", body: "suv", fuel: "petrol", cc: 1600 },
  ],
  Nissan: [
    { model: "Leaf", body: "hatchback", fuel: "electric", cc: 0 },
    { model: "X-Trail", body: "suv", fuel: "petrol", cc: 2000 },
    { model: "Note", body: "hatchback", fuel: "hybrid", cc: 1200 },
  ],
  Mitsubishi: [
    { model: "Outlander", body: "suv", fuel: "hybrid", cc: 2400 },
    { model: "L200", body: "pickup", fuel: "diesel", cc: 2500 },
    { model: "Lancer", body: "sedan", fuel: "petrol", cc: 1800 },
  ],
  Hyundai: [
    { model: "Tucson", body: "suv", fuel: "petrol", cc: 2000 },
    { model: "Creta", body: "suv", fuel: "petrol", cc: 1500 },
  ],
  Kia: [
    { model: "Sportage", body: "suv", fuel: "petrol", cc: 2000 },
    { model: "Seltos", body: "suv", fuel: "petrol", cc: 1500 },
  ],
  BMW: [
    { model: "X1", body: "suv", fuel: "petrol", cc: 2000 },
    { model: "320i", body: "sedan", fuel: "petrol", cc: 2000 },
  ],
  "Mercedes-Benz": [
    { model: "C200", body: "sedan", fuel: "petrol", cc: 2000 },
    { model: "GLC", body: "suv", fuel: "diesel", cc: 2200 },
  ],
  Mazda: [
    { model: "Demio", body: "hatchback", fuel: "petrol", cc: 1300 },
    { model: "CX-5", body: "suv", fuel: "diesel", cc: 2200 },
  ],
};

const conditions: Array<"brand_new" | "reconditioned" | "used"> = ["brand_new", "reconditioned", "used"];
const transmissions: Array<"automatic" | "manual" | "cvt"> = ["automatic", "manual", "cvt"];
const districts = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Mullaitivu", "Vavuniya", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];
const provinces: Record<string, string> = {
  Colombo: "Western", Gampaha: "Western", Kalutara: "Western",
  Kandy: "Central", Matale: "Central", "Nuwara Eliya": "Central",
  Galle: "Southern", Matara: "Southern", Hambantota: "Southern",
  Jaffna: "Northern", Kilinochchi: "Northern", Mannar: "Northern",
  Mullaitivu: "Northern", Vavuniya: "Northern",
  Batticaloa: "Eastern", Ampara: "Eastern", Trincomalee: "Eastern",
  Kurunegala: "North Western", Puttalam: "North Western",
  Anuradhapura: "North Central", Polonnaruwa: "North Central",
  Badulla: "Uva", Monaragala: "Uva",
  Ratnapura: "Sabaragamuwa", Kegalle: "Sabaragamuwa",
};
const sources = ["ikman", "riyasewana", "autolanka", "patpat"];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateListings(): CarListing[] {
  const rand = seededRandom(42);
  const listings: CarListing[] = [];
  let id = 1;

  for (const make of makes) {
    const makeModels = models[make] || [];
    for (const mm of makeModels) {
      const count = Math.ceil(rand() * 3);
      for (let i = 0; i < count; i++) {
        const year = 2010 + Math.floor(rand() * 15);
        const condition = conditions[Math.floor(rand() * conditions.length)];
        const transmission = transmissions[Math.floor(rand() * transmissions.length)];
        const district = districts[Math.floor(rand() * districts.length)];
        const mileage = condition === "brand_new" ? 0 : Math.floor(rand() * 200000);
        const basePrice = mm.cc * (condition === "brand_new" ? 6000 : condition === "reconditioned" ? 4000 : 2500);
        const yearFactor = 1 + (year - 2010) * 0.08;
        const price = Math.round(basePrice * yearFactor * (0.7 + rand() * 0.6));
        const median = Math.round(price * (0.85 + rand() * 0.3));
        const dealScore = Math.round(100 * (1 - price / median));
        const clampedScore = Math.max(-100, Math.min(100, dealScore));
        const source = sources[Math.floor(rand() * sources.length)];
        const priceDrop = rand() > 0.7 ? Math.round(rand() * 15 * 10) / 10 : undefined;

        listings.push({
          id: id++,
          source,
          source_id: `${source}_${id}`,
          make,
          model: mm.model,
          year,
          condition,
          mileage_km: mileage,
          transmission,
          fuel_type: mm.fuel as any,
          engine_cc: mm.cc,
          body_type: mm.body as any,
          color: ["White", "Black", "Silver", "Blue", "Red", "Grey"][Math.floor(rand() * 6)],
          price_lkr: price,
          deal_score: clampedScore,
          market_median_lkr: median,
          price_drop_pct: priceDrop,
          district,
          province: provinces[district] || "Western",
          is_dealer: rand() > 0.6,
          title: `${make} ${mm.model} ${year}`,
          detail_url: `#/listing/${id}`,
          thumbnail_url: `https://placehold.co/400x225/1A1A1A/888?text=${make}+${mm.model}`,
          scraped_at: new Date(Date.now() - Math.floor(rand() * 7 * 86400000)).toISOString(),
          first_seen_at: new Date(Date.now() - Math.floor(rand() * 30 * 86400000)).toISOString(),
        });
      }
    }
  }
  return listings;
}

export const mockListings = generateListings();

export const mockStats = {
  total_listings: mockListings.length,
  avg_price_lkr: Math.round(mockListings.reduce((s, l) => s + Number(l.price_lkr || 0), 0) / mockListings.length),
  listings_this_week: Math.floor(mockListings.length * 0.15),
  price_change_mom: -2.3,
  top_makes: makes.slice(0, 6).map((make) => ({
    make,
    count: mockListings.filter((l) => l.make === make).length,
  })),
  district_count: 25,
  good_deals_count: mockListings.filter((l) => l.deal_score > 20).length,
  last_updated: new Date().toISOString(),
};

export const mockPriceTrends = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - (11 - i));
  return {
    month: d.toISOString().slice(0, 7),
    median_price: 8000000 + Math.round(Math.sin(i * 0.5) * 500000),
    avg_price: 8500000 + Math.round(Math.sin(i * 0.5) * 400000),
    sample_count: 100 + Math.floor(Math.random() * 50),
  };
});

export const mockDistrictPrices = [
  { district: "Colombo", avg_price: 9500000, listing_count: 1200, lat: 6.9271, lng: 79.8612 },
  { district: "Gampaha", avg_price: 8200000, listing_count: 800, lat: 7.0917, lng: 80.0000 },
  { district: "Kandy", avg_price: 7800000, listing_count: 450, lat: 7.2906, lng: 80.6337 },
  { district: "Galle", avg_price: 7200000, listing_count: 320, lat: 6.0535, lng: 80.2210 },
  { district: "Kurunegala", avg_price: 6800000, listing_count: 280, lat: 7.4863, lng: 80.3623 },
  { district: "Kalutara", avg_price: 7500000, listing_count: 260, lat: 6.5854, lng: 80.0000 },
  { district: "Matara", avg_price: 6500000, listing_count: 180, lat: 5.9549, lng: 80.5550 },
  { district: "Ratnapura", avg_price: 6200000, listing_count: 150, lat: 6.6828, lng: 80.3992 },
  { district: "Jaffna", avg_price: 7000000, listing_count: 200, lat: 9.6615, lng: 80.0255 },
  { district: "Badulla", avg_price: 5800000, listing_count: 120, lat: 6.9934, lng: 81.0550 },
  { district: "Anuradhapura", avg_price: 6000000, listing_count: 140, lat: 8.3114, lng: 80.4037 },
  { district: "Hambantota", avg_price: 5500000, listing_count: 100, lat: 6.1429, lng: 81.1212 },
  { district: "Puttalam", avg_price: 6100000, listing_count: 130, lat: 8.0362, lng: 79.8283 },
  { district: "Trincomalee", avg_price: 5900000, listing_count: 90, lat: 8.5874, lng: 81.2152 },
  { district: "Batticaloa", avg_price: 5700000, listing_count: 85, lat: 7.7310, lng: 81.6747 },
  { district: "Nuwara Eliya", avg_price: 7100000, listing_count: 95, lat: 6.9497, lng: 80.7891 },
  { district: "Matale", avg_price: 6300000, listing_count: 100, lat: 7.4675, lng: 80.6234 },
  { district: "Ampara", avg_price: 5600000, listing_count: 80, lat: 7.3018, lng: 81.6747 },
  { district: "Kegalle", avg_price: 6400000, listing_count: 110, lat: 7.2513, lng: 80.3464 },
  { district: "Monaragala", avg_price: 5300000, listing_count: 60, lat: 6.8728, lng: 81.3507 },
  { district: "Polonnaruwa", avg_price: 5900000, listing_count: 70, lat: 7.9403, lng: 81.0188 },
  { district: "Vavuniya", avg_price: 5800000, listing_count: 65, lat: 8.7514, lng: 80.4971 },
  { district: "Mannar", avg_price: 5400000, listing_count: 45, lat: 8.9810, lng: 79.9044 },
  { district: "Kilinochchi", avg_price: 5200000, listing_count: 40, lat: 9.3803, lng: 80.3770 },
  { district: "Mullaitivu", avg_price: 5100000, listing_count: 35, lat: 9.2671, lng: 80.8142 },
];

export const SRI_LANKA_DISTRICTS = districts;
