export type Condition = "brand_new" | "reconditioned" | "used";
export type Transmission = "automatic" | "manual" | "cvt" | "tiptronic";
export type FuelType = "petrol" | "diesel" | "hybrid" | "electric" | "plugin_hybrid";
export type BodyType = "sedan" | "suv" | "hatchback" | "van" | "truck" | "motorcycle" | "pickup" | "wagon" | "coupe" | "convertible";
export type SortOption = "newest" | "deal_score" | "price_asc" | "price_desc" | "mileage_asc";
export type PriceAvailability = "priced" | "unavailable";

export interface CarListing {
  id: number;
  source: string;
  source_id: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  condition: Condition;
  mileage_km: number;
  transmission: Transmission;
  fuel_type: FuelType;
  engine_cc?: number;
  body_type: BodyType;
  color?: string;
  price_lkr: number | null;
  deal_score: number;
  market_median_lkr?: number;
  price_drop_pct?: number;
  district: string;
  province: string;
  city?: string;
  lat?: number;
  lng?: number;
  is_dealer: boolean;
  seller_name?: string;
  title: string;
  description?: string;
  url?: string;
  detail_url: string;
  external_url?: string;
  thumbnail_url?: string;
  images?: string[];
  scraped_at: string;
  first_seen_at: string;
}

export interface SellerTrustProfile {
  source: string;
  source_url: string;
  seller_name?: string;
  seller_type: "dealer" | "private" | "unknown";
  member_since?: string;
  listing_count?: number;
  review_count?: number;
  rating?: number;
  phone_numbers: string[];
  whatsapp_numbers: string[];
  verified_badges: string[];
  fetched_at?: string;
}

export interface StatsOverview {
  total_listings: number;
  avg_price_lkr: number;
  listings_this_week: number;
  price_change_mom: number;
  top_makes: { make: string; count: number }[];
  district_count: number;
  good_deals_count: number;
  source_count: number;
  last_updated: string | null;
}

export interface PriceEstimate {
  low: number;
  median: number;
  high: number;
  currency: string;
  confidence: "high" | "medium" | "low";
  comparable_count: number;
  methodology: string;
  mileage_adjusted: boolean;
}

export interface PriceTrendPoint {
  month: string;
  median_price: number;
  avg_price: number;
  sample_count: number;
}

export type PriceTrendCoverageScope =
  | "exact"
  | "condition_fallback"
  | "district_fallback"
  | "national_fallback"
  | "partial"
  | "current_snapshot"
  | "current_snapshot_fallback"
  | "none";

export interface PriceTrendSeries {
  points: PriceTrendPoint[];
  coverage_scope: PriceTrendCoverageScope;
  coverage_note: string | null;
}

export interface DistrictPrice {
  district: string;
  avg_price: number;
  listing_count: number;
  lat: number;
  lng: number;
  top_make?: string;
  top_model?: string;
  top_model_count?: number;
}

export interface SegmentPerformance {
  segment: string;
  listing_count: number;
  avg_price_lkr: number;
  change_pct_30d: number | null;
}

export interface TrendingModelInsight {
  make: string;
  model: string;
  listing_count: number;
  avg_price_lkr: number;
  movement_pct: number | null;
  thumbnail_url: string | null;
}

export interface HotDealInsight {
  id: number;
  make: string;
  model: string;
  year: number;
  district: string | null;
  source: string;
  price_lkr: number;
  deal_score: number;
  thumbnail_url: string | null;
}

export interface DashboardInsights {
  new_listings_24h: number;
  segment_performance: SegmentPerformance[];
  trending_models: TrendingModelInsight[];
  hot_deals: HotDealInsight[];
}

export interface DistrictTopModel {
  make: string;
  model: string;
  listing_count: number;
  avg_price_lkr: number;
}

export interface DistrictQuickInsight {
  district: string;
  listing_count: number;
  avg_price_lkr: number | null;
  median_price_lkr: number | null;
  change_pct_30d: number | null;
  top_models: DistrictTopModel[];
}

export interface PipelineJobStatus {
  name: string;
  status: "ok" | "running" | "delayed";
  last_status?: string | null;
  last_success: string | null;
  last_run: string | null;
  last_finished?: string | null;
  last_error?: string | null;
  expected_hours: number;
}

export interface PipelineStatusResponse {
  generated_at: string;
  overall_status: "ok" | "running" | "delayed";
  jobs: PipelineJobStatus[];
}

export type PipelineTriggerJob = "sync" | "alt_sync";

export interface PipelineRunRecord {
  id: number;
  source: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  listings_found: number;
  listings_new: number;
  error_message: string | null;
}

export interface PipelineRunsResponse {
  count: number;
  runs: PipelineRunRecord[];
}

export interface LiveMarketRun {
  source: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  listings_found: number;
  listings_new: number;
  error_message?: string | null;
}

export interface LiveMarketSnapshot {
  generated_at: string;
  total_listings: number;
  priced_listings: number;
  unavailable_price_listings: number;
  avg_price_lkr: number | null;
  latest_listing_at: string | null;
  active_scrape_sources: string[];
  latest_run: LiveMarketRun | null;
  source_status: LiveMarketRun[];
}

export interface PipelineTriggerResponse {
  accepted: boolean;
  job: PipelineTriggerJob;
  pid: number;
  command: string;
  started_at: string;
}

export interface FilterState {
  q?: string;
  source?: string;
  make?: string;
  model?: string;
  year_min?: number;
  year_max?: number;
  condition?: Condition;
  body_type?: BodyType;
  mileage_max?: number;
  price_min?: number;
  price_max?: number;
  transmission?: Transmission;
  fuel_type?: FuelType;
  district?: string;
  price_availability?: PriceAvailability;
  sort: SortOption;
  page: number;
}
