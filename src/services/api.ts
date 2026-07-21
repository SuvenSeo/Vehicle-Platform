import {
  CarListing,
  StatsOverview,
  PriceEstimate,
  PriceTrendPoint,
  PriceTrendSeries,
  DistrictPrice,
  FilterState,
  PipelineStatusResponse,
  PipelineRunsResponse,
  PipelineRunRecord,
  PipelineTriggerJob,
  PipelineTriggerResponse,
  DashboardInsights,
  DistrictQuickInsight,
  LiveMarketSnapshot,
  MarketSignal,
  MakeModelInsight,
  MakeInsight,
  SellerTrustProfile,
  PriceDropItem,
  PriceHistoryInfo,
  HistoryReport,
  PriceIndex,
  FuelMixData,
  HybridBandsData,
  SourceQualityResponse,
  DistrictVelocityData,
  DistrictVelocityPoint,
  EvInsightData,
  ImportEraSplitData,
  ImportEraEntry,
  ImportEraMakeRow,
} from "@/types/car";
import type {
  ProArbitrageGap,
  ProDetailPayload,
  ProDistrictProfile,
  ProMarketSnapshot,
  ProVehicleLane,
  ProVehicleLaneFilters,
} from "@/types/pro";
import { normalizeVehicleImageUrlWithBase, pickVehicleImageUrl } from "@/lib/listingImage";
import { formatPriceLkrMillions } from "@/lib/formatting";
import { authHeaders } from "@/lib/authToken";

const DEFAULT_PRODUCTION_API = "https://seo292-vehicle-platform-backend.hf.space/api/v1";
const HF_COLD_START_TIMEOUT_MS = 60_000;

type JsonRecord = Record<string, unknown>;
type QueryParams = Record<string, string | number | boolean | undefined | null>;
type EstimateParams = QueryParams;

function asJsonRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : {};
}

function normalizeApiBasePath(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/api") || trimmed.endsWith("/api/v1")) return trimmed;
  return `${trimmed}/api/v1`;
}

function resolveApiBase() {
  const configured = String(import.meta.env.VITE_API_URL || "").trim();

  if (import.meta.env.DEV) {
    return normalizeApiBasePath(configured || "/api/v1");
  }

  if (!configured) {
    return normalizeApiBasePath(DEFAULT_PRODUCTION_API);
  }

  return normalizeApiBasePath(configured);
}

export const API_BASE = resolveApiBase();
export const LISTINGS_PAGE_SIZE = 12;
const USE_MOCK = false;
const REQUEST_TIMEOUT_MS = 25000;
const MIN_REASONABLE_PRICE_LKR = 100_000;

function resolveSnapshotBase() {
  const configured = String(import.meta.env.VITE_SNAPSHOT_BASE_URL || "").trim();
  return configured ? configured.replace(/\/+$/, "") : "";
}

export const SNAPSHOT_BASE = resolveSnapshotBase();

const SOURCE_LABELS: Record<string, string> = {
  ikman: "Ikman",
  riyasewana: "Riyasewana",
  autolanka: "AutoLanka",
  autodirect: "AutoDirect",
  patpat: "Patpat",
  autostream: "AutoStream",
  carshop: "Carshop",
  saleme: "SaleMe",
  riyahub: "Riyahub",
  dimo: "Cars at DIMO",
};

export class APIError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API error ${status}: ${detail || "Request failed"}`);
    this.name = "APIError";
    this.status = status;
    this.detail = detail;
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestOptions {
  model?: string;
  pageContext?: {
    route: string;
    page: string;
    summary: string;
  };
}

export interface ChatListingResult {
  id: number;
  title: string;
  price_lkr: number | null;
  district?: string | null;
  deal_score?: number | null;
  source?: string | null;
  detail_url?: string | null;
  external_url?: string | null;
}

export interface CustomVehicleComparable {
  id: number;
  title: string;
  price_lkr: number | null;
  district?: string | null;
  deal_score?: number | null;
  detail_url?: string | null;
  external_url?: string | null;
}

export interface CustomVehicleEstimateResult {
  vehicle_label: string;
  estimated_low_lkr: number;
  estimated_median_lkr: number;
  estimated_high_lkr: number;
  comparable_count: number;
  confidence: "high" | "medium" | "low";
  verdict: string;
  verdict_label: string;
  delta_pct?: number | null;
  methodology: string;
  comparables: CustomVehicleComparable[];
}

export interface CustomVehicleEstimateInput {
  make: string;
  model: string;
  year: number;
  mileage_km?: number;
  condition?: string;
  transmission?: string;
  fuel_type?: string;
  body_type?: string;
  district?: string;
  asking_price_lkr?: number;
}

export interface ListingSourceStat {
  source: string;
  label: string;
  count: number;
}

export interface ListingSearchSuggestion {
  id: number;
  make: string;
  model: string;
  year: number;
  district?: string;
  price_lkr?: number | null;
  source: string;
  thumbnail_url?: string;
  url?: string;
}

export interface FeedbackInput {
  category: "bug" | "idea" | "data" | "ux" | "general";
  route?: string;
  message: string;
  email?: string;
}

export interface FeedbackReceipt {
  id: number;
  category: string;
  route?: string | null;
  status: string;
  created_at: string;
}

function canonicalSource(value: unknown): string | null {
  const compact = String(value || "").trim().toLowerCase().replace(/[-_.\s]/g, "");
  if (!compact) return null;
  if (compact.startsWith("ikman")) return "ikman";
  if (compact.startsWith("riyasewana")) return "riyasewana";
  if (["autolanka", "autolankacom", "autolankalk", "autolankasite"].includes(compact)) return "autolanka";
  if (compact.startsWith("autodirect")) return "autodirect";
  if (compact.startsWith("patpat")) return "patpat";
  if (compact.startsWith("autostream")) return "autostream";
  if (compact.startsWith("carshop")) return "carshop";
  if (["saleme", "salemelk"].includes(compact)) return "saleme";
  if (["riyahub", "riyahublk"].includes(compact)) return "riyahub";
  if (["dimo", "carsatdimo", "dimoautomobiles"].includes(compact)) return "dimo";
  return compact;
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source.replace(/[-_.]/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normalizeConditionFilter(condition?: string): string | undefined {
  const compact = String(condition || "").trim().toLowerCase().replace(/[-_\s]/g, "");
  if (!compact || compact === "all") return undefined;
  if (["brandnew", "new", "unregistered", "zeromileage"].includes(compact)) return "new";
  if (["reconditioned", "recon"].includes(compact)) return "reconditioned";
  if (["used", "preowned", "secondowner"].includes(compact)) return "used";
  return String(condition || "").trim().toLowerCase();
}

async function parseApiError(response: Response): Promise<APIError> {
  const raw = await response.text().catch(() => "");
  let detail = raw || response.statusText || "Request failed";

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.detail === "string") {
        detail = parsed.detail;
      } else if (Array.isArray(parsed?.detail)) {
        detail = parsed.detail
          .map((item: JsonRecord) => (typeof item?.msg === "string" ? item.msg : JSON.stringify(item)))
          .join("; ");
      }
    } catch {
      // Keep original text payload as API detail when JSON parsing fails.
    }
  }

  return new APIError(response.status, detail);
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeConditionValue(value: unknown): string | undefined {
  const compact = String(value || "").trim().toLowerCase().replace(/[-_\s]/g, "");
  if (!compact) return undefined;
  if (["brandnew", "new", "unregistered", "zerokm", "zeromileage"].includes(compact)) return "brand_new";
  if (["reconditioned", "recon", "recondition"].includes(compact)) return "reconditioned";
  if (["used", "preowned", "secondowner"].includes(compact)) return "used";
  return undefined;
}

function normalizeTransmissionValue(value: unknown): string | undefined {
  const compact = String(value || "").trim().toLowerCase().replace(/[-_\s]/g, "");
  if (!compact) return undefined;
  if (compact.includes("tiptronic")) return "tiptronic";
  if (compact.includes("cvt")) return "cvt";
  if (compact.includes("manual")) return "manual";
  if (compact.includes("auto")) return "automatic";
  return undefined;
}

function normalizeFuelValue(value: unknown): string | undefined {
  const compact = String(value || "").trim().toLowerCase().replace(/[-_\s]/g, "");
  if (!compact) return undefined;
  if (compact.includes("pluginhybrid") || compact.includes("phev")) return "plugin_hybrid";
  if (compact.includes("hybrid")) return "hybrid";
  if (compact.includes("diesel")) return "diesel";
  if (compact.includes("petrol") || compact.includes("gasoline")) return "petrol";
  if (compact.includes("electric") || compact.includes("ev")) return "electric";
  return undefined;
}

function normalizeBodyTypeValue(value: unknown): string | undefined {
  const compact = String(value || "").trim().toLowerCase().replace(/[-_\s]/g, "");
  if (!compact) return undefined;
  if (compact.includes("hatchback") || compact === "hatch") return "hatchback";
  if (compact.includes("crossover") || compact === "cuv") return "crossover";
  if (compact.includes("suv") || compact.includes("sportutility")) return "suv";
  if (compact.includes("pickup") || compact.includes("doublecab") || compact.includes("singlecab")) return "pickup";
  if (compact.includes("truck") && !compact.includes("pickup")) return "truck";
  if (compact === "mpv" || compact.includes("minivan")) return "mpv";
  if (compact.includes("van")) return "van";
  if (compact.includes("wagon") || compact.includes("estate")) return "wagon";
  if (compact.includes("coupe")) return "coupe";
  if (compact.includes("convertible") || compact.includes("cabriolet")) return "convertible";
  if (compact.includes("sedan") || compact.includes("saloon")) return "sedan";
  if (compact.includes("jeep") || compact === "4x4" || compact.includes("fourwheel")) return "jeep";
  if (compact.includes("luxury") || compact === "premium") return "luxury";
  if (
    compact === "mini" ||
    compact.includes("minicooper") ||
    compact.includes("keicar") ||
    compact.includes("citycar") ||
    compact.includes("microcar")
  ) {
    return "mini";
  }
  if (compact.includes("motorcycl") || compact.includes("motorbike") || compact.includes("scooter")) {
    return "motorcycle";
  }
  return undefined;
}

const NON_CAR_CATEGORIES = new Set([
  "motorbikes",
  "motorcycles",
  "bike",
  "bikes",
  "three-wheelers",
  "three-wheels",
  "threewheeler",
  "vans",
  "van",
  "buses",
  "bus",
  "lorries",
  "lorries-trucks",
  "trucks",
  "truck",
  "tipper",
  "heavy-duty",
  "heavy-duties",
  "heavy",
  "tractors",
  "tractor",
  "bicycles",
  "bicycle",
  "push-cycles",
  "boats",
  "boats-water-transport",
  "others",
]);

const BROWSE_CATEGORY_ALIASES: Record<string, Set<string>> = {
  cars: new Set(["cars", "car", "suvs", "suv", "jeeps", "wagons", "pickups", "pickup", "crew-cabs", "crew-cab", "sports"]),
  motorbikes: new Set(["motorbikes", "motorcycles", "bike", "bikes"]),
  "three-wheelers": new Set(["three-wheelers", "three-wheels", "threewheeler"]),
  vans: new Set(["vans", "van"]),
  buses: new Set(["buses", "bus"]),
  lorries: new Set(["lorries", "lorries-trucks", "trucks", "truck", "tipper"]),
  "heavy-duty": new Set(["heavy-duty", "heavy-duties", "heavy"]),
  tractors: new Set(["tractors", "tractor"]),
  bicycles: new Set(["bicycles", "bicycle", "push-cycles"]),
  boats: new Set(["boats", "boats-water-transport"]),
  others: new Set(["others"]),
};

const LUXURY_MAKES = new Set([
  "mercedes",
  "mercedesbenz",
  "bmw",
  "audi",
  "lexus",
  "landrover",
  "porsche",
  "jaguar",
  "bentley",
  "maserati",
  "ferrari",
  "lamborghini",
  "rollsroyce",
  "astonmartin",
  "cadillac",
  "infiniti",
  "genesis",
]);

function normalizeVehicleCategoryValue(value: unknown): string | undefined {
  const token = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "");
  return token || undefined;
}

function matchesBrowseCategory(listingCategory: string | undefined, browse: string): boolean {
  if (browse === "cars") {
    if (listingCategory && NON_CAR_CATEGORIES.has(listingCategory)) return false;
    return true;
  }
  const aliases = BROWSE_CATEGORY_ALIASES[browse];
  if (!aliases) return listingCategory === browse;
  return Boolean(listingCategory && aliases.has(listingCategory));
}

function matchesBodyTypeFilter(listing: CarListing, bodyType: string): boolean {
  const wanted = normalizeBodyTypeValue(bodyType) || bodyType;
  const listingBody = normalizeBodyTypeValue(listing.body_type);
  if (listingBody && listingBody === wanted) return true;

  if (wanted === "luxury") {
    const make = String(listing.make || "")
      .toLowerCase()
      .replace(/[-_\s.]/g, "");
    if (LUXURY_MAKES.has(make)) return true;
    const hay = `${listing.title || ""}`.toLowerCase();
    return /luxury|premium/.test(hay);
  }
  if (wanted === "jeep") {
    const category = normalizeVehicleCategoryValue(
      (listing as CarListing & { vehicle_category?: string }).vehicle_category,
    );
    if (category === "jeeps" || category === "jeep") return true;
    return /\bjeep\b|4[\s-]?x[\s-]?4/i.test(`${listing.title || ""}`);
  }
  if (wanted === "mini") {
    const make = String(listing.make || "").toLowerCase();
    if (make === "mini" || make === "micro") return true;
    return /mini\s*cooper|city\s*car|kei\s*car/i.test(`${listing.title || ""}`);
  }
  return false;
}

function normalizeListing(raw: JsonRecord): CarListing {
  const sourceUrls = [raw?.url, raw?.detail_url, raw?.external_url];
  const images = Array.isArray(raw?.images)
    ? raw.images
        .map((url: unknown) => normalizeVehicleImageUrlWithBase(url, sourceUrls))
        .filter((url: string | null): url is string => Boolean(url))
    : undefined;
  const thumbnailUrl = pickVehicleImageUrl([raw?.thumbnail_url, ...(images || [])], sourceUrls) || undefined;
  const listingUrl = String(raw?.url || raw?.detail_url || raw?.external_url || "").trim() || undefined;
  const detailUrl = String(raw?.detail_url || listingUrl || "").trim() || undefined;
  const externalUrl = String(raw?.external_url || listingUrl || "").trim() || undefined;

  const condition = normalizeConditionValue(raw?.condition);
  const transmission = normalizeTransmissionValue(raw?.transmission);
  const fuelType = normalizeFuelValue(raw?.fuel_type);
  const bodyType = normalizeBodyTypeValue(raw?.body_type);

  return {
    ...raw,
    url: listingUrl,
    detail_url: detailUrl,
    external_url: externalUrl,
    year: Number(raw?.year) || 0,
    mileage_km: toNumberOrNull(raw?.mileage_km ?? raw?.mileage),
    engine_cc: toNumberOrNull(raw?.engine_cc ?? raw?.engine_capacity) ?? undefined,
    price_lkr: toNumberOrNull(raw?.price_lkr),
    deal_score: toNumberOrNull(raw?.deal_score),
    market_median_lkr: toNumberOrNull(raw?.market_median_lkr) ?? undefined,
    condition,
    transmission,
    fuel_type: fuelType,
    body_type: bodyType,
    thumbnail_url: thumbnailUrl,
    images,
    // Snapshot payloads predate the lifecycle flag — default to active so
    // only an explicit backend false renders the possibly-sold state.
    is_active: raw?.is_active === undefined ? true : Boolean(raw.is_active),
    last_seen_at: raw?.last_seen_at ? String(raw.last_seen_at) : undefined,
  } as CarListing;
}

const snapshotJsonCache = new Map<string, Promise<unknown>>();
let snapshotCatalogPromise: Promise<CarListing[] | null> | null = null;

async function fetchSnapshotJSON<T>(fileName: string): Promise<T> {
  if (!SNAPSHOT_BASE) {
    throw new Error("Snapshot base is not configured");
  }

  const normalizedFile = fileName.replace(/^\/+/, "");
  const url = new URL(`${SNAPSHOT_BASE}/${normalizedFile}`, window.location.origin).toString();
  const cached = snapshotJsonCache.get(url);
  if (cached) return cached as Promise<T>;

  const request = fetch(url, {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Snapshot ${normalizedFile} failed with ${response.status}`);
      }
      return response.json() as Promise<T>;
    })
    .catch((error) => {
      snapshotJsonCache.delete(url);
      throw error;
    });

  snapshotJsonCache.set(url, request);
  return request as Promise<T>;
}

async function readSnapshot<T>(fileName: string): Promise<T | null> {
  if (!SNAPSHOT_BASE) return null;
  try {
    return await fetchSnapshotJSON<T>(fileName);
  } catch {
    return null;
  }
}

function getSnapshotListingCatalog(): Promise<CarListing[] | null> {
  if (!SNAPSHOT_BASE) return Promise.resolve(null);
  if (!snapshotCatalogPromise) {
    snapshotCatalogPromise = readSnapshot<{ items?: unknown[] }>("listing-catalog.json").then((snapshot) => {
      if (!snapshot || !Array.isArray(snapshot.items)) return null;
      return snapshot.items.map(normalizeListing);
    });
  }
  return snapshotCatalogPromise;
}

function normalizeStatsOverview(data: JsonRecord): StatsOverview {
  return {
    total_listings: Number(data?.total_listings ?? data?.priced_listings ?? data?.offers_count) || 0,
    avg_price_lkr: toNumberOrNull(data?.avg_price_lkr ?? data?.average_price_lkr ?? data?.avg_price) ?? 0,
    listings_this_week: Number(data?.listings_this_week ?? data?.new_listings_this_week) || 0,
    price_change_mom: toNumberOrNull(data?.price_change_mom ?? data?.mom_change_pct),
    top_makes: Array.isArray(data?.top_makes) ? data.top_makes : [],
    district_count: Number(data?.district_count ?? data?.districts_covered) || 0,
    good_deals_count: Number(data?.good_deals_count ?? data?.hot_deals_count) || 0,
    source_count: Number(data?.source_count ?? data?.sources_count) || 0,
    last_updated: data?.last_updated || data?.last_scrape_at || data?.updated_at
      ? String(data.last_updated ?? data.last_scrape_at ?? data.updated_at)
      : null,
  };
}

function normalizeLiveMarketData(data: JsonRecord): LiveMarketSnapshot {
  return {
    generated_at: String(data?.generated_at || new Date().toISOString()),
    total_listings: Number(data?.total_listings || 0),
    priced_listings: Number(data?.priced_listings || 0),
    unavailable_price_listings: Number(data?.unavailable_price_listings || 0),
    avg_price_lkr: toNumberOrNull(data?.avg_price_lkr),
    latest_listing_at: data?.latest_listing_at ? String(data.latest_listing_at) : null,
    active_scrape_sources: Array.isArray(data?.active_scrape_sources)
      ? data.active_scrape_sources.map((row: unknown) => String(row)).filter(Boolean)
      : [],
    latest_run: (() => {
      const latestRun = asJsonRecord(data.latest_run);
      if (!data.latest_run) return null;
      return {
          source: String(latestRun.source || "unknown"),
          status: String(latestRun.status || "UNKNOWN"),
          started_at: latestRun.started_at ? String(latestRun.started_at) : null,
          finished_at: latestRun.finished_at ? String(latestRun.finished_at) : null,
          listings_found: Number(latestRun.listings_found || 0),
          listings_new: Number(latestRun.listings_new || 0),
          error_message: latestRun.error_message ? String(latestRun.error_message) : null,
        };
    })(),
    source_status: Array.isArray(data?.source_status)
      ? data.source_status.map((row: JsonRecord) => ({
          source: String(row?.source || "unknown"),
          status: String(row?.status || "UNKNOWN"),
          started_at: row?.started_at ? String(row.started_at) : null,
          finished_at: row?.finished_at ? String(row.finished_at) : null,
          listings_found: Number(row?.listings_found || 0),
          listings_new: Number(row?.listings_new || 0),
          error_message: row?.error_message ? String(row.error_message) : null,
        }))
      : [],
  };
}

function normalizeDistrictPricesPayload(data: JsonRecord): DistrictPrice[] {
  const points = Array.isArray(data.points) ? data.points : [];
  return points.map((point): DistrictPrice => {
    const p = asJsonRecord(point);
    return {
      district: String(p.district || ""),
      avg_price: toNumberOrNull(p.avg_price_lkr ?? p.avg_price) ?? 0,
      listing_count: Number(p.count ?? p.listing_count) || 0,
      lat: toNumberOrNull(p.lat) ?? 0,
      lng: toNumberOrNull(p.lng) ?? 0,
      top_make: p?.top_make ? String(p.top_make) : undefined,
      top_model: p?.top_model ? String(p.top_model) : undefined,
      top_model_count: toNumberOrNull(p?.top_model_count) ?? undefined,
    };
  }).filter((p) => Boolean(p.district) && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function normalizeListingSourceRows(rows: unknown): ListingSourceStat[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      const source = canonicalSource(item.source || item.label);
      if (!source) return null;
      return {
        source,
        label: String(item.label || sourceLabel(source)),
        count: Number(item.count || 0),
      };
    })
    .filter((row): row is ListingSourceStat => Boolean(row && row.source));
}

function normalizeDashboardInsights(data: Record<string, unknown>): DashboardInsights {
  const segmentPerformance = Array.isArray(data.segment_performance)
    ? data.segment_performance.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          segment: String(item.segment || "unknown"),
          listing_count: Number(item.listing_count || 0),
          avg_price_lkr: toNumberOrNull(item.avg_price_lkr) ?? 0,
          change_pct_30d: toNumberOrNull(item.change_pct_30d),
        };
      })
    : [];

  const trendingModels = Array.isArray(data.trending_models)
    ? data.trending_models.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          make: String(item.make || ""),
          model: String(item.model || ""),
          listing_count: Number(item.listing_count || 0),
          avg_price_lkr: toNumberOrNull(item.avg_price_lkr) ?? 0,
          movement_pct: toNumberOrNull(item.movement_pct),
          thumbnail_url: item.thumbnail_url ? String(item.thumbnail_url) : null,
        };
      })
    : [];

  const hotDeals = Array.isArray(data.hot_deals)
    ? data.hot_deals.reduce<DashboardInsights["hot_deals"]>((acc, row) => {
        const item = row as Record<string, unknown>;
        const id = Number(item.id || 0);
        const price = toNumberOrNull(item.price_lkr);

        if (!Number.isFinite(id) || id <= 0 || price === null || price <= 0) {
          return acc;
        }

        acc.push({
          id,
          make: String(item.make || ""),
          model: String(item.model || ""),
          year: Number(item.year || 0),
          district: item.district ? String(item.district) : null,
          source: String(item.source || "unknown"),
          price_lkr: price,
          deal_score: toNumberOrNull(item.deal_score) ?? 0,
          thumbnail_url: item.thumbnail_url ? String(item.thumbnail_url) : null,
        });
        return acc;
      }, [])
    : [];

  return {
    new_listings_24h: Number(data.new_listings_24h || 0),
    segment_performance: segmentPerformance,
    trending_models: trendingModels,
    hot_deals: hotDeals,
  };
}

function textIncludes(value: unknown, needle: string): boolean {
  return String(value || "").toLowerCase().includes(needle);
}

function isPricedListing(listing: CarListing): boolean {
  const price = toNumberOrNull(listing.price_lkr);
  return price !== null && price >= MIN_REASONABLE_PRICE_LKR;
}

function listingTimestamp(listing: CarListing): number {
  const parsed = Date.parse(String(listing.scraped_at || listing.first_seen_at || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesSnapshotFilters(listing: CarListing, filters: FilterState): boolean {
  const q = String(filters.q || "").trim().toLowerCase();
  if (q) {
    const haystack = [
      listing.title,
      listing.make,
      listing.model,
      listing.variant,
      listing.district,
      listing.city,
      listing.source,
      listing.year,
    ];
    if (!haystack.some((value) => textIncludes(value, q))) return false;
  }

  const listingSource = canonicalSource(listing.source);
  const filterSource = canonicalSource(filters.source);
  if (filterSource && listingSource !== filterSource) return false;

  if (filters.make && String(listing.make || "").toLowerCase() !== String(filters.make).toLowerCase()) return false;
  if (filters.model && String(listing.model || "").toLowerCase() !== String(filters.model).toLowerCase()) return false;
  if (filters.district && String(listing.district || "").toLowerCase() !== String(filters.district).toLowerCase()) return false;
  if (filters.year_min && Number(listing.year || 0) < filters.year_min) return false;
  if (filters.year_max && Number(listing.year || 0) > filters.year_max) return false;
  if (filters.mileage_max && Number(listing.mileage_km || 0) > filters.mileage_max) return false;

  if (filters.condition && normalizeConditionValue(listing.condition) !== filters.condition) return false;
  if (filters.body_type && !matchesBodyTypeFilter(listing, filters.body_type)) return false;
  if (filters.transmission && normalizeTransmissionValue(listing.transmission) !== filters.transmission) return false;
  if (filters.fuel_type && normalizeFuelValue(listing.fuel_type) !== filters.fuel_type) return false;

  const browseCategory = filters.vehicle_category || "cars";
  const listingCategory = normalizeVehicleCategoryValue(
    (listing as CarListing & { vehicle_category?: string }).vehicle_category,
  );
  if (browseCategory === "cars") {
    if (listingCategory && NON_CAR_CATEGORIES.has(listingCategory)) return false;
    if (!listingCategory) {
      const hay = `${listing.title || ""} ${listing.make || ""} ${listing.model || ""}`.toLowerCase();
      if (/(motorbike|motorcycle|scooter|three[\s-]?wheel|tractor|bicycle|lorry|ntorq|bajaj\s+re|tvs\s+king)/i.test(hay)) {
        return false;
      }
    }
  } else if (!matchesBrowseCategory(listingCategory, browseCategory)) {
    return false;
  }

  const price = toNumberOrNull(listing.price_lkr);
  const minReasonablePrice = browseCategory === "cars" ? MIN_REASONABLE_PRICE_LKR : 25_000;
  if (filters.price_availability === "priced" && (price === null || price < minReasonablePrice)) return false;
  if (filters.price_availability === "unavailable" && isPricedListing(listing)) return false;
  if (filters.price_min !== undefined && filters.price_min !== null && (price === null || price < filters.price_min)) return false;
  if (filters.price_max !== undefined && filters.price_max !== null && (price === null || price > filters.price_max)) return false;

  return true;
}

function sortSnapshotListings(listings: CarListing[], sort: FilterState["sort"]): CarListing[] {
  return [...listings].sort((a, b) => {
    if (sort === "deal_score") {
      return (toNumberOrNull(b.deal_score) ?? -Infinity) - (toNumberOrNull(a.deal_score) ?? -Infinity)
        || listingTimestamp(b) - listingTimestamp(a)
        || Number(b.id || 0) - Number(a.id || 0);
    }
    if (sort === "price_asc") {
      return (toNumberOrNull(a.price_lkr) ?? Infinity) - (toNumberOrNull(b.price_lkr) ?? Infinity)
        || listingTimestamp(b) - listingTimestamp(a);
    }
    if (sort === "price_desc") {
      return (toNumberOrNull(b.price_lkr) ?? -Infinity) - (toNumberOrNull(a.price_lkr) ?? -Infinity)
        || listingTimestamp(b) - listingTimestamp(a);
    }
    if (sort === "mileage_asc") {
      return (toNumberOrNull(a.mileage_km) ?? Infinity) - (toNumberOrNull(b.mileage_km) ?? Infinity)
        || listingTimestamp(b) - listingTimestamp(a);
    }
    return listingTimestamp(b) - listingTimestamp(a) || Number(b.id || 0) - Number(a.id || 0);
  });
}

function filterSnapshotListings(
  catalog: CarListing[],
  filters: FilterState,
  pageSize = LISTINGS_PAGE_SIZE,
): { listings: CarListing[]; total: number } {
  const matched = catalog.filter((listing) => matchesSnapshotFilters(listing, filters));
  const sorted = sortSnapshotListings(matched, filters.sort || "newest");
  const page = Math.max(1, Number(filters.page || 1));
  const size = Math.max(1, pageSize);
  const start = (page - 1) * size;
  return {
    listings: sorted.slice(start, start + size),
    total: matched.length,
  };
}

function deriveMakes(catalog: CarListing[]): { make: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const listing of catalog) {
    const make = String(listing.make || "").trim();
    if (!make) continue;
    counts.set(make, (counts.get(make) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([make, count]) => ({ make, count }))
    .sort((a, b) => b.count - a.count || a.make.localeCompare(b.make));
}

function deriveModels(catalog: CarListing[], make: string): { model: string; count: number }[] {
  const makeKey = String(make || "").trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const listing of catalog) {
    if (makeKey && String(listing.make || "").toLowerCase() !== makeKey) continue;
    const model = String(listing.model || "").trim();
    if (!model) continue;
    counts.set(model, (counts.get(model) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model));
}

function deriveSources(catalog: CarListing[]): ListingSourceStat[] {
  const counts = new Map<string, number>();
  for (const listing of catalog) {
    const source = canonicalSource(listing.source);
    if (!source) continue;
    counts.set(source, (counts.get(source) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, label: sourceLabel(source), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function searchSuggestionsFromCatalog(catalog: CarListing[], q: string, limit: number): ListingSearchSuggestion[] {
  const query = String(q || "").trim().toLowerCase();
  if (!query) return [];
  return sortSnapshotListings(catalog.filter((listing) => matchesSnapshotFilters(listing, {
    q: query,
    sort: "newest",
    page: 1,
  })), "newest")
    .slice(0, Math.max(1, limit))
    .map((listing) => ({
      id: Number(listing.id),
      make: String(listing.make || "").trim(),
      model: String(listing.model || "").trim(),
      year: Number(listing.year) || 0,
      district: listing.district ? String(listing.district) : undefined,
      price_lkr: toNumberOrNull(listing.price_lkr),
      source: canonicalSource(listing.source) || String(listing.source || "unknown").trim().toLowerCase(),
      thumbnail_url: listing.thumbnail_url ? String(listing.thumbnail_url) : undefined,
      url: listing.url ? String(listing.url) : undefined,
    }))
    .filter((row) => row.id > 0 && row.make && row.model && row.year > 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildSnapshotTrendSeries(
  catalog: CarListing[],
  make: string,
  model: string,
  condition?: string,
  district?: string,
): PriceTrendSeries {
  const makeKey = String(make || "").trim().toLowerCase();
  const modelKey = String(model || "").trim().toLowerCase();
  const conditionKey = normalizeConditionValue(condition) || normalizeConditionValue(normalizeConditionFilter(condition));
  const districtKey = String(district || "").trim().toLowerCase();

  const rows = catalog.filter((listing) => {
    if (makeKey && String(listing.make || "").toLowerCase() !== makeKey) return false;
    if (modelKey && String(listing.model || "").toLowerCase() !== modelKey) return false;
    if (conditionKey && normalizeConditionValue(listing.condition) !== conditionKey) return false;
    if (districtKey && String(listing.district || "").toLowerCase() !== districtKey) return false;
    return isPricedListing(listing);
  });

  const prices = rows
    .map((listing) => toNumberOrNull(listing.price_lkr))
    .filter((price): price is number => price !== null && price >= MIN_REASONABLE_PRICE_LKR);

  if (prices.length === 0) {
    return {
      points: [],
      coverage_scope: "none",
      coverage_note: "No matching listings in the current public snapshot.",
    };
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;

  return {
    points: [{
      month,
      median_price: Math.round(median(prices)),
      avg_price: Math.round(avg),
      sample_count: prices.length,
    }],
    coverage_scope: "current_snapshot",
    coverage_note: "Current public snapshot only; historical trend data needs the live API.",
  };
}

async function fetchJSON<T>(path: string, params?: QueryParams, headers?: Record<string, string>): Promise<T> {
  if (USE_MOCK) throw new Error("Mock mode is disabled");

  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const timeoutMs = API_BASE.includes("hf.space") ? HF_COLD_START_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const maxAttempts = API_BASE.includes("hf.space") ? 3 : 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json', ...(headers || {}) },
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await parseApiError(response);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      const isAbort = error instanceof DOMException && error.name === "AbortError";
      const isServerError = error instanceof APIError && error.status >= 500;
      const isNetworkError = error instanceof TypeError;
      const retryable = isAbort || isServerError || isNetworkError;
      if (!retryable || attempt === maxAttempts - 1) {
        throw error;
      }
      const backoffMs = Math.min(1000 * 2 ** attempt, 4000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function postJSON<T>(path: string, body: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
  if (USE_MOCK) throw new Error("Mock mode is disabled");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const response = await fetch(new URL(`${API_BASE}${path}`, window.location.origin).toString(), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json();
}

export const getStats = async (): Promise<StatsOverview> => {
  const snapshot = await readSnapshot<JsonRecord>("stats-summary.json");
  if (snapshot) return normalizeStatsOverview(snapshot);

  const data = await fetchJSON<JsonRecord>("/stats/summary");
  return normalizeStatsOverview(data);
};

export const getLiveMarketSnapshot = async (): Promise<LiveMarketSnapshot> => {
  const snapshot = await readSnapshot<JsonRecord>("live-market.json");
  if (snapshot) return normalizeLiveMarketData(snapshot);

  const data = await fetchJSON<JsonRecord>("/stats/live");
  return normalizeLiveMarketData(data);
};

export const getLiveMarketStreamUrl = (): string => {
  return new URL(`${API_BASE}/stats/live/stream`, window.location.origin).toString();
};

export const getListings = async (filters: FilterState): Promise<{ listings: CarListing[]; total: number }> => {
  const effectiveFilters: FilterState = {
    ...filters,
    vehicle_category: filters.vehicle_category || "cars",
  };
  const catalog = await getSnapshotListingCatalog();
  if (catalog) return filterSnapshotListings(catalog, effectiveFilters);

  const data = await fetchJSON<JsonRecord>("/listings", {
    ...effectiveFilters,
    size: LISTINGS_PAGE_SIZE,
  });
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    listings: items.map((item) => normalizeListing(asJsonRecord(item))),
    total: Number(data.total) || 0,
  };
};

export const sendFeedback = async (payload: FeedbackInput): Promise<FeedbackReceipt> => {
  const data = await postJSON<JsonRecord>("/feedback", {
    category: payload.category,
    route: payload.route,
    message: payload.message,
    email: payload.email || undefined,
  });

  return {
    id: Number(data?.id || 0),
    category: String(data?.category || payload.category),
    route: data?.route ? String(data.route) : null,
    status: String(data?.status || "new"),
    created_at: String(data?.created_at || new Date().toISOString()),
  };
};

export const getListing = async (id: string | number) => {
  const catalog = await getSnapshotListingCatalog();
  if (catalog) {
    const match = catalog.find((listing) => String(listing.id) === String(id));
    if (match) return match;
  }

  const data = await fetchJSON<JsonRecord>(`/listings/${id}`);
  return normalizeListing(data);
};

export const getPriceDrops = async (days = 7, limit = 12): Promise<PriceDropItem[]> => {
  const data = await fetchJSON<JsonRecord>(`/listings/price-drops?days=${days}&limit=${limit}`);
  if (!Array.isArray(data?.items)) return [];
  return data.items
    .map((row: unknown) => {
      const record = asJsonRecord(row);
      return {
        listing: normalizeListing(asJsonRecord(record?.listing)),
        previous_price_lkr: toNumberOrNull(record?.previous_price_lkr) ?? 0,
        new_price_lkr: toNumberOrNull(record?.new_price_lkr) ?? 0,
        drop_pct: toNumberOrNull(record?.drop_pct) ?? 0,
        dropped_at: String(record?.dropped_at || ""),
      };
    })
    .filter((item) => item.listing.id && item.drop_pct > 0);
};

export const getListingHistoryReport = async (id: string | number): Promise<HistoryReport> => {
  return fetchJSON<HistoryReport>(`/listings/${id}/history-report`);
};

export const getPriceIndex = async (): Promise<PriceIndex> => {
  return fetchJSON<PriceIndex>(`/stats/price-index`);
};

export const getListingPriceHistory = async (id: string | number): Promise<PriceHistoryInfo> => {
  const data = await fetchJSON<JsonRecord>(`/listings/${id}/price-history`);
  const points = Array.isArray(data?.points)
    ? data.points
        .map((row: unknown) => {
          const record = asJsonRecord(row);
          return {
            price_lkr: toNumberOrNull(record?.price_lkr) ?? 0,
            scraped_at: String(record?.scraped_at || ""),
          };
        })
        .filter((point) => point.price_lkr > 0)
    : [];

  let cutCount = 0;
  let raiseCount = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].price_lkr < points[i - 1].price_lkr) cutCount++;
    else if (points[i].price_lkr > points[i - 1].price_lkr) raiseCount++;
  }

  return {
    listing_id: Number(data?.listing_id || id),
    points,
    first_price_lkr: toNumberOrNull(data?.first_price_lkr),
    current_price_lkr: toNumberOrNull(data?.current_price_lkr),
    change_pct: toNumberOrNull(data?.change_pct),
    cut_count: toNumberOrNull(data?.cut_count) ?? cutCount,
    raise_count: toNumberOrNull(data?.raise_count) ?? raiseCount,
    highest_price_lkr: toNumberOrNull(data?.highest_price_lkr),
    lowest_price_lkr: toNumberOrNull(data?.lowest_price_lkr),
    last_change_at: data?.last_change_at ? String(data.last_change_at) : null,
    tracked_points: toNumberOrNull(data?.tracked_points) ?? points.length,
  };
};

export const getSellerTrustProfile = async (id: string | number): Promise<SellerTrustProfile> => {
  const data = await fetchJSON<JsonRecord>(`/listings/${id}/seller-profile`);
  const sellerTypeRaw = String(data?.seller_type || "").toLowerCase();
  const sellerType: SellerTrustProfile["seller_type"] =
    sellerTypeRaw === "dealer" || sellerTypeRaw === "private" ? sellerTypeRaw : "unknown";

  return {
    source: String(data?.source || ""),
    source_url: String(data?.source_url || ""),
    seller_name: data?.seller_name ? String(data.seller_name) : undefined,
    seller_type: sellerType,
    member_since: data?.member_since ? String(data.member_since) : undefined,
    listing_count: toNumberOrNull(data?.listing_count) ?? undefined,
    review_count: toNumberOrNull(data?.review_count) ?? undefined,
    rating: toNumberOrNull(data?.rating) ?? undefined,
    phone_numbers: Array.isArray(data?.phone_numbers)
      ? data.phone_numbers.map((row: unknown) => String(row)).filter(Boolean)
      : [],
    whatsapp_numbers: Array.isArray(data?.whatsapp_numbers)
      ? data.whatsapp_numbers.map((row: unknown) => String(row)).filter(Boolean)
      : [],
    verified_badges: Array.isArray(data?.verified_badges)
      ? data.verified_badges.map((row: unknown) => String(row)).filter(Boolean)
      : [],
    fetched_at: data?.fetched_at ? String(data.fetched_at) : undefined,
  };
};

export const getSimilarListings = async (id: string | number) => {
  const catalog = await getSnapshotListingCatalog();
  if (catalog) {
    const base = catalog.find((listing) => String(listing.id) === String(id));
    if (base) {
      return sortSnapshotListings(
        catalog.filter((listing) => (
          listing.id !== base.id
          && String(listing.make || "").toLowerCase() === String(base.make || "").toLowerCase()
          && String(listing.model || "").toLowerCase() === String(base.model || "").toLowerCase()
        )),
        "deal_score",
      ).slice(0, 8);
    }
  }

  const data = await fetchJSON<JsonRecord[]>(`/listings/${id}/similar`);
  return (data || []).map(normalizeListing);
};

export const getDistrictPrices = async (): Promise<DistrictPrice[]> => {
  const snapshot = await readSnapshot<JsonRecord>("district-prices.json");
  if (snapshot) return normalizeDistrictPricesPayload(snapshot);

  const data = await fetchJSON<JsonRecord>("/stats/district-prices");
  return normalizeDistrictPricesPayload(data);
};

export const getDistrictVelocity = async (): Promise<DistrictVelocityData> => {
  const raw = await fetchJSON<Record<string, unknown>>("/stats/district-velocity");
  const points: DistrictVelocityPoint[] = Array.isArray(raw?.points)
    ? (raw.points as Record<string, unknown>[]).map((p) => ({
        district: String(p?.district ?? ""),
        lat: Number(p?.lat ?? 0),
        lng: Number(p?.lng ?? 0),
        listing_count: Math.round(Number(p?.listing_count ?? 0)),
        new_7d_count: Math.round(Number(p?.new_7d_count ?? 0)),
        velocity_score: Number(p?.velocity_score ?? 0),
      }))
    : [];
  return {
    points,
    generated_at: String(raw?.generated_at ?? new Date().toISOString()),
  };
};

export const getMakes = async () => {
  const snapshot = await readSnapshot<unknown>("listing-makes.json");
  if (Array.isArray(snapshot)) return snapshot as { make: string; count: number }[];

  const catalog = await getSnapshotListingCatalog();
  if (catalog) return deriveMakes(catalog);

  return fetchJSON<{ make: string; count: number }[]>("/listings/makes");
};

export const getListingSearchSuggestions = async (
  q: string,
  limit = 8,
): Promise<ListingSearchSuggestion[]> => {
  const query = String(q || "").trim();
  if (!query) return [];

  const catalog = await getSnapshotListingCatalog();
  if (catalog) return searchSuggestionsFromCatalog(catalog, query, limit);

  const data = await fetchJSON<JsonRecord[]>("/listings/search-suggestions", { q: query, limit });
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const source = canonicalSource(row?.source) || String(row?.source || "unknown").trim().toLowerCase();
      return {
        id: Number(row?.id),
        make: String(row?.make || "").trim(),
        model: String(row?.model || "").trim(),
        year: Number(row?.year) || 0,
        district: row?.district ? String(row.district) : undefined,
        price_lkr: toNumberOrNull(row?.price_lkr),
        source,
        thumbnail_url: row?.thumbnail_url ? String(row.thumbnail_url) : undefined,
        url: row?.url ? String(row.url) : undefined,
      };
    })
    .filter((row) => row.id > 0 && row.make && row.model && row.year > 0);
};

export const getListingSources = async (): Promise<ListingSourceStat[]> => {
  const snapshot = await readSnapshot<unknown>("listing-sources.json");
  const snapshotRows = normalizeListingSourceRows(snapshot);
  if (snapshotRows.length > 0) return snapshotRows;

  const catalog = await getSnapshotListingCatalog();
  if (catalog) return deriveSources(catalog);

  try {
    const rows = await fetchJSON<Array<Record<string, unknown>>>("/listings/sources");
    if (!Array.isArray(rows)) return [];
    const normalized = normalizeListingSourceRows(rows);

    if (normalized.length > 0) {
      return normalized;
    }
  } catch {
    // Fall through to client-side source derivation for older backend deployments.
  }

  const data = await fetchJSON<JsonRecord>("/listings", { page: 1, size: 200, sort: "newest" });
  const counts = new Map<string, number>();
  for (const item of Array.isArray(data?.items) ? data.items : []) {
    const source = canonicalSource(item?.source);
    if (!source) continue;
    counts.set(source, (counts.get(source) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, label: sourceLabel(source), count }))
    .sort((a, b) => b.count - a.count);
};

export const getModels = async (make: string) => {
  const snapshot = await readSnapshot<Record<string, { model: string; count: number }[]>>("listing-models.json");
  if (snapshot) {
    const makeKey = Object.keys(snapshot).find((key) => key.toLowerCase() === String(make || "").toLowerCase());
    if (makeKey && Array.isArray(snapshot[makeKey])) return snapshot[makeKey];
  }

  const catalog = await getSnapshotListingCatalog();
  if (catalog) return deriveModels(catalog, make);

  return fetchJSON<{ model: string; count: number }[]>("/listings/models", { make });
};

export const estimatePrice = async (params: EstimateParams): Promise<PriceEstimate> => {
  const normalizedCondition = normalizeConditionFilter(
    params?.condition === undefined || params?.condition === null ? undefined : String(params.condition),
  );
  const payload = {
    ...params,
    condition: normalizedCondition,
    mileage: params.mileage ?? params.mileage_km,
  };

  try {
    const data = await fetchJSON<JsonRecord>("/listings/estimate", payload);
    const comparableCount = Number(data?.comparable_listings || 0);
    return {
      median: toNumberOrNull(data?.estimated_price_lkr) ?? 0,
      low: toNumberOrNull(data?.price_range_low) ?? 0,
      high: toNumberOrNull(data?.price_range_high) ?? 0,
      comparable_count: comparableCount,
      confidence: comparableCount > 10 ? "high" : (comparableCount > 3 ? "medium" : "low"),
      currency: "LKR",
      methodology: "exact make-model-year estimate",
      mileage_adjusted: Boolean(params?.mileage ?? params?.mileage_km),
    };
  } catch (error) {
    // Legacy /estimate is strict. Fall back to calibrated custom-estimate for better coverage.
    if (!(error instanceof APIError) || ![404, 422].includes(error.status)) {
      throw error;
    }

    const fallback = await postJSON<JsonRecord>("/listings/custom-estimate", {
      make: params?.make,
      model: params?.model,
      year: params?.year,
      mileage_km: params?.mileage_km ?? params?.mileage,
      condition: normalizedCondition,
      transmission: params?.transmission,
      fuel_type: params?.fuel_type,
      body_type: params?.body_type,
      district: params?.district,
      asking_price_lkr: params?.asking_price_lkr,
    });

    const comparableCount = Number(fallback?.comparable_count || 0);
    const confidence = String(fallback?.confidence || "").toLowerCase();
    const normalizedConfidence: PriceEstimate["confidence"] =
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : (comparableCount > 10 ? "high" : (comparableCount > 3 ? "medium" : "low"));

    return {
      median: toNumberOrNull(fallback?.estimated_median_lkr) ?? 0,
      low: toNumberOrNull(fallback?.estimated_low_lkr) ?? 0,
      high: toNumberOrNull(fallback?.estimated_high_lkr) ?? 0,
      comparable_count: comparableCount,
      confidence: normalizedConfidence,
      currency: "LKR",
      methodology: String(fallback?.methodology || "fallback custom-estimate strategy"),
      mileage_adjusted: Boolean(params?.mileage ?? params?.mileage_km),
    };
  }
};

export const estimateCustomVehicle = async (
  params: CustomVehicleEstimateInput,
): Promise<CustomVehicleEstimateResult> => {
  const data = await postJSON<JsonRecord>("/listings/custom-estimate", { ...params });
  return {
    vehicle_label: String(data?.vehicle_label || `${params.make} ${params.model}`),
    estimated_low_lkr: toNumberOrNull(data?.estimated_low_lkr) ?? 0,
    estimated_median_lkr: toNumberOrNull(data?.estimated_median_lkr) ?? 0,
    estimated_high_lkr: toNumberOrNull(data?.estimated_high_lkr) ?? 0,
    comparable_count: Number(data?.comparable_count) || 0,
    confidence: (data?.confidence as CustomVehicleEstimateResult["confidence"]) || "low",
    verdict: String(data?.verdict || ""),
    verdict_label: String(data?.verdict_label || ""),
    delta_pct: toNumberOrNull(data?.delta_pct),
    methodology: String(data?.methodology || ""),
    comparables: Array.isArray(data?.comparables)
      ? data.comparables.map((row: JsonRecord) => ({
          id: Number(row?.id),
          title: String(row?.title || "Listing"),
          price_lkr: toNumberOrNull(row?.price_lkr),
          district: row?.district ? String(row.district) : null,
          deal_score: toNumberOrNull(row?.deal_score),
          detail_url: row?.detail_url ? String(row.detail_url) : null,
          external_url: row?.external_url ? String(row.external_url) : null,
        }))
      : [],
  };
};

export const getListingThumbnailProxyUrl = (listingId: number | string): string => {
  return `${API_BASE}/listings/${listingId}/thumbnail-proxy`;
};

export const getPriceTrendSeries = async (
  make: string,
  model: string,
  condition?: string,
  district?: string
): Promise<PriceTrendSeries> => {
  const catalog = await getSnapshotListingCatalog();
  if (catalog) return buildSnapshotTrendSeries(catalog, make, model, condition, district);

  const normalizedCondition = normalizeConditionFilter(condition);
  const normalizedDistrict = String(district || "").trim() || undefined;
  const data = await fetchJSON<JsonRecord>("/stats/trends", {
    make,
    model,
    ...(normalizedCondition ? { condition: normalizedCondition } : {}),
    ...(normalizedDistrict ? { district: normalizedDistrict } : {}),
  });
  const trendPoints = Array.isArray(data.points) ? data.points : [];
  const points = trendPoints.map((point) => {
    const p = asJsonRecord(point);
    return {
    month: `${p.year}-${String(p.month).padStart(2, "0")}`,
    median_price: toNumberOrNull(p.median_price_lkr ?? p.avg_price_lkr) ?? 0,
    avg_price: toNumberOrNull(p.avg_price_lkr) ?? 0,
    sample_count: Number(p.listing_count) || 0,
  };
  }).sort((a: PriceTrendPoint, b: PriceTrendPoint) => a.month.localeCompare(b.month));

  const rawScope = String(data?.coverage_scope || "exact");
  const allowedScopes = new Set<PriceTrendSeries["coverage_scope"]>([
    "exact",
    "condition_fallback",
    "district_fallback",
    "national_fallback",
    "partial",
    "current_snapshot",
    "current_snapshot_fallback",
    "none",
  ]);

  return {
    points,
    coverage_scope: allowedScopes.has(rawScope as PriceTrendSeries["coverage_scope"])
      ? (rawScope as PriceTrendSeries["coverage_scope"])
      : "exact",
    coverage_note: data?.coverage_note ? String(data.coverage_note) : null,
  };
};

export const getPriceTrends = async (
  make: string,
  model: string,
  condition?: string,
  district?: string
): Promise<PriceTrendPoint[]> => {
  const series = await getPriceTrendSeries(make, model, condition, district);
  return series.points;
};

export const getPipelineStatus = async () => {
  const snapshot = await readSnapshot<PipelineStatusResponse>("pipeline-status.json");
  if (snapshot) return snapshot;
  return fetchJSON<PipelineStatusResponse>("/pipeline/status");
};

export const getPipelineRuns = async (limit = 20): Promise<PipelineRunsResponse> => {
  const data = await fetchJSON<Record<string, unknown>>("/pipeline/runs", { limit });
  const runs: PipelineRunRecord[] = Array.isArray(data.runs)
    ? data.runs.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          id: Number(item.id || 0),
          source: String(item.source || "unknown"),
          status: String(item.status || "UNKNOWN"),
          started_at: item.started_at ? String(item.started_at) : null,
          finished_at: item.finished_at ? String(item.finished_at) : null,
          listings_found: Number(item.listings_found || 0),
          listings_new: Number(item.listings_new || 0),
          error_message: item.error_message ? String(item.error_message) : null,
        };
      })
    : [];

  return {
    count: Number(data.count || runs.length),
    runs,
  };
};

export const triggerPipelineJob = async (job: PipelineTriggerJob, adminKey?: string): Promise<PipelineTriggerResponse> => {
  const data = await postJSON<Record<string, unknown>>(
    "/pipeline/trigger",
    { job },
    adminKey ? { "X-Admin-Key": adminKey } : undefined,
  );

  return {
    accepted: Boolean(data.accepted),
    job: (String(data.job || job) as PipelineTriggerJob),
    pid: Number(data.pid || 0),
    command: String(data.command || ""),
    started_at: String(data.started_at || new Date().toISOString()),
  };
};

export const getDashboardInsights = async (): Promise<DashboardInsights> => {
  const snapshot = await readSnapshot<Record<string, unknown>>("dashboard-insights.json");
  if (snapshot) return normalizeDashboardInsights(snapshot);

  const data = await fetchJSON<Record<string, unknown>>("/stats/insights");
  return normalizeDashboardInsights(data);
};

export const getProMarketSnapshot = async (): Promise<ProMarketSnapshot> => {
  return fetchJSON<ProMarketSnapshot>("/pro/market-snapshot", undefined, authHeaders());
};

export const getProVehicleLanes = async (
  filters: ProVehicleLaneFilters = {},
): Promise<ProVehicleLane[]> => {
  return fetchJSON<ProVehicleLane[]>("/pro/vehicle-lanes", { ...filters }, authHeaders());
};

export const getProDistricts = async (): Promise<ProDistrictProfile[]> => {
  return fetchJSON<ProDistrictProfile[]>("/pro/districts", undefined, authHeaders());
};

export const getProVehicleLaneDetail = async (
  params: Pick<ProVehicleLaneFilters, "make" | "model" | "district" | "condition">,
): Promise<ProDetailPayload> => {
  return fetchJSON<ProDetailPayload>("/pro/vehicle-lane-detail", params, authHeaders());
};

export const getProDistrictDetail = async (district: string): Promise<ProDetailPayload> => {
  return fetchJSON<ProDetailPayload>("/pro/district-detail", { district }, authHeaders());
};

export const getProArbitrageGaps = async (
  make: string,
  model: string,
  limit = 10,
): Promise<ProArbitrageGap[]> => {
  return fetchJSON<ProArbitrageGap[]>("/pro/arbitrage-gaps", { make, model, limit }, authHeaders());
};

export const getListingsForExport = async (
  filters: FilterState,
  maxRows = 100,
): Promise<{ listings: CarListing[]; total: number }> => {
  const size = Math.max(1, Math.min(100, Math.floor(maxRows)));
  const catalog = await getSnapshotListingCatalog();
  if (catalog) return filterSnapshotListings(catalog, { ...filters, page: 1 }, size);

  const data = await fetchJSON<JsonRecord>("/listings", {
    ...filters,
    page: 1,
    size,
  });

  const items = Array.isArray(data.items) ? data.items : [];
  return {
    listings: items.map((item) => normalizeListing(asJsonRecord(item))),
    total: Number(data.total || 0),
  };
};

export const getDistrictQuickInsight = async (district: string): Promise<DistrictQuickInsight> => {
  const catalog = await getSnapshotListingCatalog();
  if (catalog) {
    const districtKey = String(district || "").trim().toLowerCase();
    const rows = catalog.filter((listing) => String(listing.district || "").toLowerCase() === districtKey);
    if (rows.length > 0) {
      const priced = rows.map((listing) => toNumberOrNull(listing.price_lkr)).filter((price): price is number => price !== null);
      const sortedPrices = [...priced].sort((a, b) => a - b);
      const modelCounts = new Map<string, { make: string; model: string; count: number; total: number }>();
      for (const listing of rows) {
        const price = toNumberOrNull(listing.price_lkr);
        const make = String(listing.make || "").trim();
        const model = String(listing.model || "").trim();
        if (!make || !model || price === null) continue;
        const key = `${make}\u0000${model}`;
        const existing = modelCounts.get(key) || { make, model, count: 0, total: 0 };
        existing.count += 1;
        existing.total += price;
        modelCounts.set(key, existing);
      }

      return {
        district,
        listing_count: rows.length,
        avg_price_lkr: priced.length ? priced.reduce((sum, price) => sum + price, 0) / priced.length : null,
        median_price_lkr: sortedPrices.length ? sortedPrices[Math.floor(sortedPrices.length / 2)] : null,
        change_pct_30d: null,
        top_models: Array.from(modelCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((row) => ({
            make: row.make,
            model: row.model,
            listing_count: row.count,
            avg_price_lkr: row.total / row.count,
          })),
      };
    }
  }

  const data = await fetchJSON<Record<string, unknown>>("/stats/district-insight", { district });

  const topModels = Array.isArray(data.top_models)
    ? data.top_models.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          make: String(item.make || ""),
          model: String(item.model || ""),
          listing_count: Number(item.listing_count || 0),
          avg_price_lkr: toNumberOrNull(item.avg_price_lkr) ?? 0,
        };
      })
    : [];

  return {
    district: String(data.district || district),
    listing_count: Number(data.listing_count || 0),
    avg_price_lkr: toNumberOrNull(data.avg_price_lkr),
    median_price_lkr: toNumberOrNull(data.median_price_lkr),
    change_pct_30d: toNumberOrNull(data.change_pct_30d),
    top_models: topModels,
  };
};

function normalizeMarketSignal(row: JsonRecord): MarketSignal {
  return {
    id: Number(row.id || 0),
    source: String(row.source || "unknown"),
    signal_type: String(row.signal_type || "unknown"),
    period_year: toNumberOrNull(row.period_year),
    period_month: toNumberOrNull(row.period_month),
    metric: String(row.metric || ""),
    category: row.category ? String(row.category) : null,
    value_numeric: toNumberOrNull(row.value_numeric),
    unit: row.unit ? String(row.unit) : null,
    source_url: String(row.source_url || ""),
    observed_at: String(row.observed_at || ""),
  };
}

export const getMarketSignals = async (limit = 6): Promise<MarketSignal[]> => {
  const data = await fetchJSON<JsonRecord[]>("/market/signals", { limit });
  return (data || []).map(normalizeMarketSignal);
};

export const getMarketSignal = async (id: number): Promise<MarketSignal> => {
  try {
    const data = await fetchJSON<JsonRecord>(`/market/signals/${id}`);
    const signal = normalizeMarketSignal(data);
    if (signal.id === id) return signal;
  } catch {
    // Fall through — older backends / cold starts may lack GET /signals/{id}.
  }

  const rows = await getMarketSignals(500);
  const found = rows.find((signal) => signal.id === id);
  if (found) return found;

  throw new APIError(404, "Market signal not found");
};

export const getMakeModelInsight = async (make: string, model: string): Promise<MakeModelInsight> => {
  const catalog = await getSnapshotListingCatalog();
  if (catalog) {
    const makeKey = make.trim().toLowerCase();
    const modelKey = model.trim().toLowerCase();
    const rows = catalog.filter(
      (l) =>
        String(l.make || "").toLowerCase() === makeKey &&
        String(l.model || "").toLowerCase() === modelKey,
    );
    const prices = rows
      .map((l) => toNumberOrNull(l.price_lkr))
      .filter((p): p is number => p !== null && p >= MIN_REASONABLE_PRICE_LKR);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : null;
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sortedPrices.length / 2);
    const medianVal = sortedPrices.length
      ? sortedPrices.length % 2 === 0
        ? (sortedPrices[mid - 1] + sortedPrices[mid]) / 2
        : sortedPrices[mid]
      : null;

    const districtMap = new Map<string, { count: number; total: number; priced: number }>();
    for (const l of rows) {
      const d = String(l.district || "").trim();
      if (!d) continue;
      const entry = districtMap.get(d) ?? { count: 0, total: 0, priced: 0 };
      entry.count += 1;
      const price = toNumberOrNull(l.price_lkr);
      if (price !== null && price >= MIN_REASONABLE_PRICE_LKR) {
        entry.total += price;
        entry.priced += 1;
      }
      districtMap.set(d, entry);
    }
    const top_districts = Array.from(districtMap.entries())
      .map(([district, { count, total, priced }]) => ({
        district,
        count,
        avg_price_lkr: priced > 0 ? total / priced : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const sample = rows[0];
    return {
      make: sample ? String(sample.make || make).trim() : make.trim(),
      model: sample ? String(sample.model || model).trim() : model.trim(),
      total: rows.length,
      avg_price_lkr: avg,
      median_price_lkr: medianVal,
      top_districts,
    };
  }

  const data = await fetchJSON<JsonRecord>("/stats/make-model-insight", { make, model });
  return {
    make: String(data.make || make),
    model: String(data.model || model),
    total: Number(data.total || 0),
    avg_price_lkr: toNumberOrNull(data.avg_price_lkr),
    median_price_lkr: toNumberOrNull(data.median_price_lkr),
    top_districts: Array.isArray(data.top_districts)
      ? (data.top_districts as JsonRecord[]).map((row) => ({
          district: String(row.district || ""),
          count: Number(row.count || 0),
          avg_price_lkr: toNumberOrNull(row.avg_price_lkr),
        }))
      : [],
  };
};

export const getMakeInsight = async (make: string): Promise<MakeInsight> => {
  const data = await fetchJSON<JsonRecord>("/stats/make-insight", { make });
  return {
    make: String(data.make || make),
    total: Number(data.total || 0),
    avg_price_lkr: toNumberOrNull(data.avg_price_lkr),
    median_price_lkr: toNumberOrNull(data.median_price_lkr),
    top_models: Array.isArray(data.top_models)
      ? (data.top_models as JsonRecord[]).map((row) => ({
          model: String(row.model || ""),
          count: Number(row.count || 0),
          avg_price_lkr: toNumberOrNull(row.avg_price_lkr),
        }))
      : [],
    top_districts: Array.isArray(data.top_districts)
      ? (data.top_districts as JsonRecord[]).map((row) => ({
          district: String(row.district || ""),
          count: Number(row.count || 0),
          avg_price_lkr: toNumberOrNull(row.avg_price_lkr),
        }))
      : [],
  };
};

export const formatPrice = (price: number | null): string => {
  return formatPriceLkrMillions(price);
};

// ---------------------------------------------------------------------------
// Market Alerts — server-side (anonymous token pattern)
// ---------------------------------------------------------------------------

const ALERT_TOKEN_KEY = "autolens.alert_token.v1";

export function getOrCreateAlertToken(): string {
  try {
    if (typeof window === "undefined") return "";
    const stored = window.localStorage.getItem(ALERT_TOKEN_KEY);
    if (stored && stored.length >= 8 && stored.length <= 36) return stored;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(ALERT_TOKEN_KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}

export interface AlertCreateInput {
  make?: string;
  model?: string;
  max_price?: number;
  district?: string;
  notify_phone?: string;
}

export interface ServerMarketAlert {
  id: number;
  user_token: string;
  make: string | null;
  model: string | null;
  max_price: number | null;
  district: string | null;
  notify_phone?: string | null;
  active: boolean;
  created_at: string;
}

export interface AlertMatchListing {
  id: number;
  title: string | null;
  make: string;
  model: string;
  year: number | null;
  price_lkr: number | null;
  district: string | null;
  deal_score: number | null;
  thumbnail_url: string | null;
}

export interface AlertMatchResult {
  alert_id: number;
  make: string | null;
  model: string | null;
  district: string | null;
  max_price: number | null;
  matching_count: number;
  listings: AlertMatchListing[];
}

export interface AlertMatchResponse {
  results: AlertMatchResult[];
  checked_at: string;
}

function alertTokenHeader(token: string): Record<string, string> {
  return token ? { "X-Alert-Token": token } : {};
}

export const getAlerts = async (token: string): Promise<ServerMarketAlert[]> => {
  if (!token) return [];
  return fetchJSON<ServerMarketAlert[]>("/alerts", { token });
};

export const createAlert = async (token: string, data: AlertCreateInput): Promise<ServerMarketAlert> => {
  return postJSON<ServerMarketAlert>("/alerts", { ...data }, alertTokenHeader(token));
};

export const deleteAlert = async (token: string, id: number): Promise<void> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = new URL(`${API_BASE}/alerts/${id}`, window.location.origin).toString();
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Accept: "application/json", ...alertTokenHeader(token) },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok && response.status !== 204) {
    throw await parseApiError(response);
  }
};

export const matchAlerts = async (token: string): Promise<AlertMatchResponse> => {
  if (!token) return { results: [], checked_at: new Date().toISOString() };
  return fetchJSON<AlertMatchResponse>("/alerts/match", { token });
};

function normalizeFuelMixData(data: JsonRecord): FuelMixData {
  const buckets = Array.isArray(data.buckets)
    ? data.buckets.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          fuel_type: String(item.fuel_type || "other"),
          count: Number(item.count || 0),
          pct: Number(item.pct ?? 0),
        };
      })
    : [];
  return {
    total: Number(data.total || 0),
    buckets,
    generated_at: String(data.generated_at || new Date().toISOString()),
  };
}

function normalizeHybridBandsData(data: JsonRecord): HybridBandsData {
  const bands = Array.isArray(data.bands)
    ? data.bands.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          label: String(item.label || ""),
          cc_max: toNumberOrNull(item.cc_max),
          count: Number(item.count || 0),
          median_price_lkr: toNumberOrNull(item.median_price_lkr),
        };
      })
    : [];
  return {
    total_hybrids: Number(data.total_hybrids || 0),
    bands,
    generated_at: String(data.generated_at || new Date().toISOString()),
  };
}

export const getFuelMix = async (): Promise<FuelMixData> => {
  const data = await fetchJSON<JsonRecord>("/stats/fuel-mix");
  return normalizeFuelMixData(data);
};

export const getHybridBands = async (): Promise<HybridBandsData> => {
  const data = await fetchJSON<JsonRecord>("/stats/hybrid-bands");
  return normalizeHybridBandsData(data);
};

function normalizeEvInsightData(data: JsonRecord): EvInsightData {
  const topEvModels = Array.isArray(data.top_ev_models)
    ? (data.top_ev_models as JsonRecord[]).map((row) => ({
        make: String(row.make || ""),
        model: String(row.model || ""),
        listing_count: Number(row.listing_count || 0),
        median_price_lkr: toNumberOrNull(row.median_price_lkr),
      }))
    : [];

  const benchmarkRaw = asJsonRecord(data.hybrid_benchmark);
  const hybridBenchmark = {
    make: String(benchmarkRaw.make || "Toyota"),
    model: String(benchmarkRaw.model || "Aqua"),
    median_price_lkr: toNumberOrNull(benchmarkRaw.median_price_lkr),
    listing_count: Number(benchmarkRaw.listing_count || 0),
  };

  return {
    ev_count: Number(data.ev_count || 0),
    ev_pct: Number(data.ev_pct ?? 0),
    median_ev_price_lkr: toNumberOrNull(data.median_ev_price_lkr),
    top_ev_models: topEvModels,
    hybrid_benchmark: hybridBenchmark,
    generated_at: String(data.generated_at || new Date().toISOString()),
  };
}

export const getEvInsight = async (): Promise<EvInsightData> => {
  const data = await fetchJSON<JsonRecord>("/stats/ev-insight");
  return normalizeEvInsightData(data);
};

export const formatNumber = (num: number): string => {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// ---------------------------------------------------------------------------
// Dealer — inventory benchmark
// ---------------------------------------------------------------------------

export interface UrlBenchmarkResult {
  url: string;
  make: string | null;
  model: string | null;
  year: number | null;
  listing_price: number | null;
  market_median: number | null;
  price_gap_pct: number | null;
  comparable_count: number;
  error: string | null;
}

export const benchmarkDealerUrls = async (
  urls: string[],
): Promise<UrlBenchmarkResult[]> => {
  const data = await postJSON<UrlBenchmarkResult[]>("/dealer/benchmark-urls", { urls });
  return Array.isArray(data) ? data : [];
};

export interface DealerClaimProfile {
  id: number;
  claim_token: string;
  display_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  seller_name_pattern: string | null;
  claimed_url: string | null;
  status: string;
  matched_listings: number;
  verified_at?: string | null;
  plan?: string;
  subscription_status?: string;
  billing_email?: string | null;
  current_period_end?: string | null;
}

const DEALER_CLAIM_TOKEN_KEY = "motormila.dealer_claim_token.v1";

export function getStoredDealerClaimToken(): string | null {
  try {
    return window.localStorage.getItem(DEALER_CLAIM_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeDealerClaimToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(DEALER_CLAIM_TOKEN_KEY, token);
    else window.localStorage.removeItem(DEALER_CLAIM_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export const claimDealerProfile = async (payload: {
  display_name: string;
  contact_phone?: string;
  contact_email?: string;
  seller_name_pattern?: string;
  claimed_url?: string;
  claim_token?: string;
}): Promise<DealerClaimProfile> => {
  return postJSON<DealerClaimProfile>("/dealer/claim", payload);
};

export const getDealerProfile = async (claimToken: string): Promise<DealerClaimProfile> => {
  return fetchJSON<DealerClaimProfile>("/dealer/me", { claim_token: claimToken });
};

export const sendChatMessage = async (
  message: string,
  history: ChatMessage[],
  options?: ChatRequestOptions,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const model = String(options?.model || "").trim();
  const pageContext = options?.pageContext;

  const response = await fetch(new URL(`${API_BASE}/chat`, window.location.origin).toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      history,
      ...(model ? { model } : {}),
      ...(pageContext ? { page_context: pageContext } : {}),
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${errorText || response.statusText}`);
  }

  const data = await response.json().catch(() => ({}));
  return {
    response: String(data?.response || data?.message || "No response available"),
    listings: Array.isArray(data?.listings)
      ? data.listings
          .map((row: JsonRecord) => ({
            id: Number(row?.id),
            title: String(row?.title || "Listing"),
            price_lkr: toNumberOrNull(row?.price_lkr),
            district: row?.district ? String(row.district) : null,
            deal_score: toNumberOrNull(row?.deal_score),
            source: row?.source ? String(row.source) : null,
            detail_url: row?.detail_url ? String(row.detail_url) : null,
            external_url: row?.external_url ? String(row.external_url) : null,
          }))
          .filter((row: ChatListingResult) => Number.isFinite(row.id) && row.id > 0)
      : [],
  };
};

export const getSourceQuality = async (): Promise<SourceQualityResponse> => {
  const data = await fetchJSON<Record<string, unknown>>("/stats/source-quality");
  const sources = Array.isArray(data.sources)
    ? (data.sources as Record<string, unknown>[]).map((row) => ({
        source: String(row.source || ""),
        listing_count: Number(row.listing_count || 0),
        price_fill_rate: Number(row.price_fill_rate ?? 0),
        fresh_24h_pct: Number(row.fresh_24h_pct ?? 0),
        outlier_rate: Number(row.outlier_rate ?? 0),
        duplicate_rate: Number(row.duplicate_rate ?? 0),
      }))
    : [];
  return {
    generated_at: String(data.generated_at || new Date().toISOString()),
    sources,
  };
};

function normalizeImportEraEntry(raw: Record<string, unknown>): ImportEraEntry {
  const eraRaw = String(raw?.era || "");
  const era = eraRaw === "post_freeze" ? "post_freeze" : "pre_freeze";
  return {
    era,
    label: String(raw?.label || (era === "pre_freeze" ? "Pre-freeze (≤2024)" : "Post-freeze (≥2025)")),
    count: Number(raw?.count || 0),
    median_price_lkr: toNumberOrNull(raw?.median_price_lkr),
  };
}

function normalizeImportEraMakeRow(raw: Record<string, unknown>): ImportEraMakeRow {
  return {
    make: String(raw?.make || ""),
    pre_freeze: normalizeImportEraEntry(asJsonRecord(raw?.pre_freeze)),
    post_freeze: normalizeImportEraEntry(asJsonRecord(raw?.post_freeze)),
  };
}

export const getImportEraSplit = async (topN?: number): Promise<ImportEraSplitData> => {
  const params: QueryParams = {};
  if (topN !== undefined) params.top_n = topN;
  const data = await fetchJSON<Record<string, unknown>>("/stats/import-era-split", params);
  const makes: ImportEraMakeRow[] = Array.isArray(data?.makes)
    ? (data.makes as Record<string, unknown>[])
        .map(normalizeImportEraMakeRow)
        .filter((row) => Boolean(row.make))
    : [];
  return {
    makes,
    freeze_boundary_year: Number(data?.freeze_boundary_year || 2025),
    generated_at: String(data?.generated_at || new Date().toISOString()),
  };
};

export interface LandedCostInput {
  cif_usd: number;
  exchange_rate: number;
  fuel_type: "petrol" | "diesel" | "hybrid" | "electric";
  engine_cc?: number;
  motor_kw?: number;
  apply_surcharge: boolean;
  apply_sscl: boolean;
}

export interface LandedCostResult {
  cif_lkr: number;
  cid: number;
  surcharge: number;
  excise: number;
  sscl: number;
  vat: number;
  luxury_tax: number;
  total_tax: number;
  landed_cost: number;
  surcharge_applied: boolean;
  notes: string;
}

export interface TcoInput {
  daily_km: number;
  fuel_type: "petrol" | "diesel" | "hybrid" | "electric";
  mileage_kmpl: number;
  lease_installment: number;
  insurance_annual: number;
  service_annual: number;
  tyres_annual: number;
  resale_loss_annual: number;
}

export interface TcoResult {
  fuel_price_lkr: number;
  fuel_cost_monthly: number;
  lease_cost_monthly: number;
  overhead_cost_monthly: number;
  total_tco_monthly: number;
  notes: string;
}

export interface PermitInfo {
  id: number;
  permit_name: string;
  permit_type: string;
  market_price_lkr: number;
}

export const calculateLandedCost = async (input: LandedCostInput): Promise<LandedCostResult> => {
  return await postJSON<LandedCostResult>("/calculators/landed-cost", input as unknown as Record<string, unknown>);
};

export const calculateTco = async (input: TcoInput): Promise<TcoResult> => {
  return await postJSON<TcoResult>("/calculators/tco", input as unknown as Record<string, unknown>);
};

export const getPermits = async (): Promise<PermitInfo[]> => {
  const data = await fetchJSON<PermitInfo[]>("/calculators/permits");
  return Array.isArray(data) ? data : [];
};
