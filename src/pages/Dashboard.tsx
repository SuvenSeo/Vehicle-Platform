import { scrollBehavior } from "@/lib/motion";
import { startTransition, useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { FilterState, CarListing, DashboardInsights, DistrictVelocityPoint } from "@/types/car";
import { getPriceDrops,
  getStats, getListings, getMakes,
  formatPrice, getDashboardInsights, LISTINGS_PAGE_SIZE, getDistrictVelocity,
} from "@/services/api";
import { useLiveMarketSnapshot } from "@/hooks/useLiveMarketSnapshot";
import { ListingCard } from "@/components/ListingCard";
import { ComparisonModal } from "@/components/ComparisonModal";
import { FilterSidebar } from "@/components/FilterSidebar";
import { MarketIntelligencePanel } from "@/components/MarketIntelligencePanel";
import { MarketSignalsStrip } from "@/components/MarketSignalsStrip";
import { FuelMixStrip } from "@/components/FuelMixStrip";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";
import { HeroSideSignals } from "@/components/HeroSideSignals";
import { RevealSection } from "@/components/RevealSection";
import { SectionHeader } from "@/components/SectionHeader";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingDown,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  LayoutGrid,
  List,
  Scale,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { StatsOverview } from "@/types/car";
import {
  getListing,
  getListingSearchSuggestions,
  type ListingSearchSuggestion,
} from "@/services/api";
import { useAppPreferences } from "@/lib/appPreferences";
import { loadWatchlistIds, saveWatchlistIds, toggleWatchlistId } from "@/lib/watchlist";
import { pickVehicleImageUrl } from "@/lib/listingImage";
import { isReasonableListingPrice } from "@/lib/formatting";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";
import { PriceUnavailableBadge } from "@/components/PriceUnavailableBadge";
import { ListingCardSkeleton } from "@/components/ListingCardSkeleton";
import { loadMarketAlerts, patchMarketAlertServerId, removeMarketAlert, saveMarketAlert, summarizeAlertFilters, type MarketAlert } from "@/lib/marketAlerts";
import { useServerMarketAlerts } from "@/hooks/useServerMarketAlerts";
import { QUERY_STALE } from "@/lib/queryPolicy";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";

const heroContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  }
} as const;

const heroItemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 220,
      damping: 24
    }
  }
} as const;

const cardContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02
    }
  }
} as const;

const cardItemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 25
    }
  }
} as const;

const DistrictVelocityMap = lazyWithRetry(() =>
  import("@/components/DistrictVelocityMap").then((m) => ({ default: m.DistrictVelocityMap }))
);
const ProvinceVelocityStrip = lazyWithRetry(() =>
  import("@/components/ProvinceVelocityStrip").then((m) => ({ default: m.ProvinceVelocityStrip }))
);

const EMPTY_VELOCITY_POINTS: DistrictVelocityPoint[] = [];

const SORT_VALUES = ["newest", "deal_score", "price_asc", "price_desc", "mileage_asc"] as const;

function parseOptionalNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isSortValue(value: string | null): value is FilterState["sort"] {
  return value !== null && (SORT_VALUES as readonly string[]).includes(value);
}

function normalizeSourceValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const compact = value.trim().toLowerCase().replace(/[-_.\s]/g, "");
  if (!compact) return undefined;
  if (compact.startsWith("ikman")) return "ikman";
  if (compact.startsWith("riyasewana")) return "riyasewana";
  if (["autolanka", "autolankacom", "autolankasite", "autolankalk"].includes(compact)) return "autolanka";
  if (compact.startsWith("autodirect")) return "autodirect";
  if (compact.startsWith("patpat")) return "patpat";
  if (compact.startsWith("autostream")) return "autostream";
  if (compact.startsWith("carshop")) return "carshop";
  if (["saleme", "salemelk"].includes(compact)) return "saleme";
  if (["riyahub", "riyahublk"].includes(compact)) return "riyahub";
  if (["dimo", "carsatdimo", "dimoautomobiles"].includes(compact)) return "dimo";
  return value.trim().toLowerCase();
}

function parseFilters(params: URLSearchParams): FilterState {
  const sort = params.get("sort");
  const priceAvailability = params.get("price_availability");
  const vehicleCategory = params.get("vehicle_category");
  const allowedCategories = new Set([
    "cars",
    "motorbikes",
    "three-wheelers",
    "vans",
    "buses",
    "lorries",
    "heavy-duty",
    "tractors",
    "bicycles",
    "boats",
    "others",
  ]);
  return {
    q: params.get("q") || undefined,
    source: normalizeSourceValue(params.get("source")),
    make: params.get("make") || undefined,
    model: params.get("model") || undefined,
    year_min: parseOptionalNumber(params.get("year_min")),
    year_max: parseOptionalNumber(params.get("year_max")),
    price_min: parseOptionalNumber(params.get("price_min")),
    price_max: parseOptionalNumber(params.get("price_max")),
    mileage_max: parseOptionalNumber(params.get("mileage_max")),
    condition: (params.get("condition") as FilterState["condition"]) || undefined,
    body_type: (params.get("body_type") as FilterState["body_type"]) || undefined,
    transmission: (params.get("transmission") as FilterState["transmission"]) || undefined,
    fuel_type: (params.get("fuel_type") as FilterState["fuel_type"]) || undefined,
    district: params.get("district") || undefined,
    vehicle_category:
      vehicleCategory && allowedCategories.has(vehicleCategory)
        ? (vehicleCategory as FilterState["vehicle_category"])
        : "cars",
    price_availability: priceAvailability === "unavailable" ? "unavailable" : undefined,
    sort: isSortValue(sort) ? sort : "newest",
    page: Math.max(1, parseOptionalNumber(params.get("page")) || 1),
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => parseFilters(searchParams));

  useEffect(() => {
    const nextFilters = parseFilters(searchParams);
    setFilters((prev) => {
      const keys = Object.keys(nextFilters) as (keyof FilterState)[];
      return keys.some((k) => prev[k] !== nextFilters[k]) ? nextFilters : prev;
    });
  }, [searchParams]);

  const { t } = useAppPreferences();
  const queryClient = useQueryClient();
  const liveMarketSnapshot = useLiveMarketSnapshot();
  const [compareListings, setCompareListings] = useState<CarListing[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<number[]>([]);
  const [heroSearch, setHeroSearch] = useState("");
  const [heroSearchMessage, setHeroSearchMessage] = useState<string | null>(null);
  const [heroActiveIdx, setHeroActiveIdx] = useState(-1);
  const [heroSuggestions, setHeroSuggestions] = useState<ListingSearchSuggestion[]>([]);
  const [heroSuggestionsOpen, setHeroSuggestionsOpen] = useState(false);
  const [heroSuggestionsLoading, setHeroSuggestionsLoading] = useState(false);
  const [showSavedListings, setShowSavedListings] = useState(false);
  const [savedListings, setSavedListings] = useState<CarListing[]>([]);
  const [savedListingsLoading, setSavedListingsLoading] = useState(false);
  const [savedListingsError, setSavedListingsError] = useState<string | null>(null);
  const [marketView, setMarketView] = useState<"grid" | "list">("grid");
  const [newLiveListingsAvailable, setNewLiveListingsAvailable] = useState(false);
  const [marketAlerts, setMarketAlerts] = useState<MarketAlert[]>([]);
  const [showMarketAlerts, setShowMarketAlerts] = useState(false);
  const [alertPriceInput, setAlertPriceInput] = useState("");
  const liveListingAtRef = useRef<string | null>(null);

  // ── Data fetching (React Query owns caching/retries/refetching) ──

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    staleTime: QUERY_STALE.stats,
  });
  const makesQuery = useQuery({
    queryKey: ["makes"],
    queryFn: getMakes,
    staleTime: QUERY_STALE.market,
  });
  const insightsQuery = useQuery({
    queryKey: ["dashboard-insights"],
    queryFn: getDashboardInsights,
    staleTime: QUERY_STALE.hub,
    refetchInterval: 120_000,
  });
  const dropsQuery = useQuery({
    queryKey: ["price-drops"],
    queryFn: () => getPriceDrops(7, 4),
    staleTime: QUERY_STALE.market,
  });
  const velocityQuery = useQuery({
    queryKey: ["district-velocity"],
    queryFn: getDistrictVelocity,
    staleTime: QUERY_STALE.market,
    // fetchJSON already retries transient 5xx — keep RQ retries low to avoid stampede.
    retry: 1,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });
  const { refetch: refetchVelocity, data: velocityData } = velocityQuery;
  const velocityPoints = velocityData?.points ?? EMPTY_VELOCITY_POINTS;
  const retryVelocity = useCallback(() => {
    void refetchVelocity();
  }, [refetchVelocity]);
  const listingsQuery = useQuery({
    queryKey: ["listings", filters],
    queryFn: () => getListings(filters),
    staleTime: QUERY_STALE.listings,
  });
  const { refetch: refetchListings } = listingsQuery;
  const retryListings = useCallback(() => {
    void refetchListings();
  }, [refetchListings]);

  const stats: StatsOverview | null = statsQuery.data ?? null;
  const makes = useMemo(() => makesQuery.data ?? [], [makesQuery.data]);
  const dashboardInsights: DashboardInsights | null = insightsQuery.data ?? null;
  const listings = useMemo(() => listingsQuery.data?.listings ?? [], [listingsQuery.data]);
  const total = listingsQuery.data?.total ?? 0;
  const loadingListings = listingsQuery.isPending;
  const listingsFailed = listingsQuery.isError;

  const serverAlerts = useServerMarketAlerts();

  useEffect(() => {
    setWatchlistIds(loadWatchlistIds());
    setMarketAlerts(loadMarketAlerts());
  }, []);

  useEffect(() => { saveWatchlistIds(watchlistIds); }, [watchlistIds]);

  useEffect(() => {
    const query = heroSearch.trim();
    if (!query) {
      setHeroSuggestions([]); setHeroSuggestionsOpen(false);
      setHeroSuggestionsLoading(false); setHeroSearchMessage(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setHeroSuggestionsLoading(true);
      getListingSearchSuggestions(query, 8)
        .then((rows) => { if (!cancelled) { setHeroSuggestions(rows); setHeroSuggestionsOpen(true); setHeroSearchMessage(null); } })
        .catch(() => { if (!cancelled) setHeroSuggestions([]); })
        .finally(() => { if (!cancelled) setHeroSuggestionsLoading(false); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [heroSearch]);

  useEffect(() => {
    if (!showSavedListings) return;
    if (!watchlistIds.length) { setSavedListings([]); setSavedListingsError(null); setSavedListingsLoading(false); return; }
    let cancelled = false;
    setSavedListingsLoading(true); setSavedListingsError(null);
    Promise.all(watchlistIds.map(async (id) => { try { return await getListing(id); } catch { return null; } }))
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<number, CarListing>();
        rows.forEach((r) => { if (r?.id) map.set(r.id, r); });
        const hydrated = watchlistIds.map((id) => map.get(id)).filter((r): r is CarListing => Boolean(r));
        setSavedListings(hydrated);
        if (!hydrated.length) setSavedListingsError("Saved listings are currently unavailable.");
        else if (hydrated.length < watchlistIds.length) setSavedListingsError("Some saved listings are no longer available.");
      })
      .catch(() => { if (!cancelled) { setSavedListings([]); setSavedListingsError("Unable to load saved listings."); } })
      .finally(() => { if (!cancelled) setSavedListingsLoading(false); });
    return () => { cancelled = true; };
  }, [showSavedListings, watchlistIds]);

  useEffect(() => {
    const latestAt = liveMarketSnapshot?.latest_listing_at || null;
    if (!latestAt) return;
    const previous = liveListingAtRef.current;
    liveListingAtRef.current = latestAt;
    if (!previous || previous === latestAt) return;
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
    if (filters.page === 1 && filters.sort === "newest") {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      setNewLiveListingsAvailable(false);
    } else {
      setNewLiveListingsAvailable(true);
    }
  }, [queryClient, filters.page, filters.sort, liveMarketSnapshot?.latest_listing_at]);

  // ── URL sync ───────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.source) params.set("source", filters.source);
    if (filters.make) params.set("make", filters.make);
    if (filters.model) params.set("model", filters.model);
    if (filters.year_min) params.set("year_min", String(filters.year_min));
    if (filters.year_max) params.set("year_max", String(filters.year_max));
    if (filters.price_min) params.set("price_min", String(filters.price_min));
    if (filters.price_max) params.set("price_max", String(filters.price_max));
    if (filters.mileage_max) params.set("mileage_max", String(filters.mileage_max));
    if (filters.condition) params.set("condition", filters.condition);
    if (filters.body_type) params.set("body_type", filters.body_type);
    if (filters.transmission) params.set("transmission", filters.transmission);
    if (filters.fuel_type) params.set("fuel_type", filters.fuel_type);
    if (filters.district) params.set("district", filters.district);
    if (filters.vehicle_category && filters.vehicle_category !== "cars") {
      params.set("vehicle_category", filters.vehicle_category);
    }
    if (filters.price_availability === "unavailable") params.set("price_availability", filters.price_availability);
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    if (filters.page > 1) params.set("page", String(filters.page));
    const next = params.toString();
    if (next !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [filters, searchParams, setSearchParams]);

  // ── Derived data ───────────────────────────────────────────────

  const fallbackTrendingModels = useMemo(() => {
    const grouped = new Map<string, { make: string; model: string; count: number; total: number; thumbnail?: string }>();
    listings.forEach((l) => {
      const p = Number(l.price_lkr || 0);
      if (!isReasonableListingPrice(p)) return;
      const key = `${l.make}-${l.model}`;
      const item = grouped.get(key);
      const img = l.thumbnail_url || l.images?.[0];
      if (item) { item.count++; item.total += p; if (!item.thumbnail && img) item.thumbnail = img; }
      else grouped.set(key, { make: l.make, model: l.model, count: 1, total: p, thumbnail: img });
    });
    return Array.from(grouped.values())
      .map((i) => ({ ...i, avgPrice: i.total / i.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [listings]);

  const fallbackHotDeals = useMemo(
    () => [...listings]
      .filter((l) => Number(l.deal_score || 0) >= 8 && isReasonableListingPrice(Number(l.price_lkr || 0)))
      .sort((a, b) => Number(b.deal_score || 0) - Number(a.deal_score || 0))
      .slice(0, 4),
    [listings],
  );

  const trendingModels = useMemo(() => {
    const rows = dashboardInsights?.trending_models?.length
      ? dashboardInsights.trending_models.map((r) => ({
          ...r, thumbnail_url: pickVehicleImageUrl([r.thumbnail_url]),
        }))
      : fallbackTrendingModels.map((r) => ({
          make: r.make, model: r.model, listing_count: r.count,
          avg_price_lkr: r.avgPrice, movement_pct: 0, thumbnail_url: r.thumbnail || null,
        }));
    return rows;
  }, [dashboardInsights?.trending_models, fallbackTrendingModels]);

  const hotDeals = useMemo(() => {
    const rows = dashboardInsights?.hot_deals?.length
      ? dashboardInsights.hot_deals.filter((r) => isReasonableListingPrice(Number(r.price_lkr || 0)))
      : fallbackHotDeals.map((r) => ({
          id: r.id, make: r.make, model: r.model, year: r.year, district: r.district || null,
          source: r.source, price_lkr: r.price_lkr, deal_score: Number(r.deal_score || 0),
          thumbnail_url: r.thumbnail_url || r.images?.[0] || null,
        }));
    return rows.map((r) => ({ ...r, thumbnail_url: pickVehicleImageUrl([r.thumbnail_url]) }));
  }, [dashboardInsights?.hot_deals, fallbackHotDeals]);

  const heroPriceDrop = useMemo(() => {
    const drop = dropsQuery.data?.[0];
    if (!drop?.listing) return null;
    return {
      id: drop.listing.id,
      make: drop.listing.make,
      model: drop.listing.model,
      year: drop.listing.year,
      previous_price_lkr: drop.previous_price_lkr,
      new_price_lkr: drop.new_price_lkr,
      drop_pct: drop.drop_pct,
      thumbnail_url: pickVehicleImageUrl([drop.listing.thumbnail_url, drop.listing.images?.[0]]),
    };
  }, [dropsQuery.data]);

  const heroNewListings24h = Number(dashboardInsights?.new_listings_24h ?? stats?.listings_this_week ?? 0);
  const heroGoodDealsCount = Number(stats?.good_deals_count ?? 0);

  // ── Actions ────────────────────────────────────────────────────

  const toggleCompare = useCallback((listing: CarListing) => {
    setCompareListings((prev) => {
      if (prev.some((i) => i.id === listing.id)) return prev.filter((i) => i.id !== listing.id);
      if (prev.length >= 3) return prev;
      return [...prev, listing];
    });
  }, []);

  const compareIds = useMemo(() => compareListings.map((l) => l.id), [compareListings]);
  const compareIdSet = useMemo(() => new Set(compareIds), [compareIds]);
  const watchlistIdSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const toggleWatchlist = useCallback((listing: CarListing) => {
    setWatchlistIds((prev) => toggleWatchlistId(prev, listing.id).ids);
  }, []);

  const scrollToMarket = useCallback(() => {
    // Defer past the filter-change re-render: a smooth scroll started in the
    // same tick gets cancelled when the grid re-lays out.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById("market")?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      });
    });
  }, []);

  const applyHeroSuggestion = useCallback((s: ListingSearchSuggestion) => {
    setHeroSearch(`${s.make} ${s.model}`);
    setHeroSuggestionsOpen(false);
    setHeroActiveIdx(-1);
    startTransition(() => { setFilters((prev) => ({ ...prev, q: undefined, make: s.make, model: s.model, page: 1 })); });
    setHeroSearchMessage(null);
    scrollToMarket();
  }, [scrollToMarket]);

  const runHeroSearch = useCallback(() => {
    const query = heroSearch.trim();
    if (!query) return;
    if (heroSuggestions.length > 0) { applyHeroSuggestion(heroSuggestions[0]); return; }
    const normalizedQuery = query.toLowerCase();
    const makeMatch = makes.find((e) => e.make.toLowerCase().includes(normalizedQuery));
    startTransition(() => {
      setFilters((prev) => ({ ...prev, q: query, make: makeMatch?.make ?? prev.make, model: makeMatch ? undefined : prev.model, page: 1 }));
    });
    setHeroSuggestionsOpen(false);
    setHeroSearchMessage(makeMatch ? null : "Searching vehicle index only.");
    scrollToMarket();
  }, [applyHeroSuggestion, heroSearch, heroSuggestions, makes, scrollToMarket]);

  const focusModel = useCallback((make: string, model?: string) => {
    startTransition(() => { setFilters((prev) => ({ ...prev, q: undefined, make, model: model || undefined, page: 1 })); });
    scrollToMarket();
  }, [scrollToMarket]);

  const browseNewestListings = useCallback(() => {
    startTransition(() => { setFilters((prev) => ({ ...prev, sort: "newest", page: 1, vehicle_category: prev.vehicle_category || "cars" })); });
    scrollToMarket();
  }, [scrollToMarket]);

  const comparedListings = useMemo(() => listings.filter((l) => compareIdSet.has(l.id)), [listings, compareIdSet]);
  const totalPages = Math.ceil(total / LISTINGS_PAGE_SIZE);
  const currentAlertSummary = useMemo(() => summarizeAlertFilters(filters), [filters]);

  const saveCurrentMarketAlert = useCallback(() => {
    const target = Number(alertPriceInput.replace(/[^\d]/g, ""));
    const targetPrice = Number.isFinite(target) && target > 0 ? target : undefined;
    const next = saveMarketAlert(filters, targetPrice);
    setMarketAlerts(next);
    setAlertPriceInput("");
    setShowMarketAlerts(true);

    const newAlert = next[0];
    if (newAlert) {
      serverAlerts.create({
        make: filters.make ?? undefined,
        model: filters.model ?? undefined,
        district: filters.district ?? undefined,
        max_price: filters.price_max ?? targetPrice,
      }).then((created) => {
        if (created?.id) {
          setMarketAlerts(patchMarketAlertServerId(newAlert.id, created.id));
        }
      }).catch(() => {
        // Server unavailable — localStorage copy is the fallback.
      });
    }
  }, [alertPriceInput, filters, serverAlerts]);

  const deleteMarketAlert = useCallback((id: string) => {
    const alertToDelete = marketAlerts.find((a) => a.id === id);
    setMarketAlerts(removeMarketAlert(id));
    if (alertToDelete?.server_id) {
      serverAlerts.remove(alertToDelete.server_id).catch(() => {
        // Server unavailable — the local delete still succeeded.
      });
    }
  }, [marketAlerts, serverAlerts]);

  const activeFilterLabels = useMemo(
    () => [
      filters.price_availability === "unavailable" ? "Missing prices" : undefined,
      filters.vehicle_category && filters.vehicle_category !== "cars" ? filters.vehicle_category : undefined,
      filters.q ? `"${filters.q}"` : undefined,
      filters.source,
      filters.make,
      filters.model,
      filters.district,
      filters.condition?.replace(/_/g, " "),
      filters.body_type,
      filters.fuel_type,
      filters.transmission,
    ].filter(Boolean) as string[],
    [filters],
  );
    const showHeroSuggestions = (heroSuggestionsOpen || heroSuggestionsLoading) && heroSearch.trim().length > 0;

  const marketPulseListings = Number(liveMarketSnapshot?.priced_listings ?? stats?.total_listings ?? total ?? 0);
  const marketPulseDistricts = Number(stats?.district_count || 0);
  const marketPulseSources = Number(stats?.source_count || liveMarketSnapshot?.source_status?.length || 0);
  const isPriceUnavailableMode = filters.price_availability === "unavailable";
  const listingFreshnessAt = liveMarketSnapshot?.latest_listing_at ?? stats?.last_updated ?? null;

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section id="overview" className="relative -mt-16 overflow-hidden border-b border-border bg-surface pt-16">
        <div aria-hidden className="pointer-events-none absolute left-[20%] top-[-20%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[130px]" />
        <div aria-hidden className="pointer-events-none absolute bottom-[-10%] right-[10%] h-[450px] w-[450px] rounded-full bg-primary/5 blur-[110px]" />

        <motion.div
          initial="hidden"
          animate="show"
          variants={heroContainerVariants}
          className="relative z-10 mx-auto max-w-[1560px] px-5 py-12 sm:px-6 sm:py-16 lg:py-20"
        >
          <HeroSideSignals
            trending={trendingModels[0] ?? null}
            hotDeal={hotDeals[0] ?? null}
            priceDrop={heroPriceDrop}
            newListings24h={heroNewListings24h}
            goodDealsCount={heroGoodDealsCount}
            onTrendingClick={() => {
              const row = trendingModels[0];
              if (row) focusModel(row.make, row.model);
            }}
            onBrowseNewest={browseNewestListings}
          />

          {/* ── Centered editorial headline ── */}
          <div className="relative mx-auto max-w-3xl text-center">
            <motion.div variants={heroItemVariants} className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 shadow-soft backdrop-blur-md">
                <span className="relative flex h-1.5 w-1.5">
                  <span aria-hidden className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span aria-hidden className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <p className="section-eyebrow text-[10px] tracking-[0.2em]">
                  Vehicle Intelligence · Sri Lanka
                </p>
              </div>
            </motion.div>

            <motion.h1 variants={heroItemVariants} className="display-hero mx-auto mt-6 max-w-5xl text-foreground">
              Sri Lanka&rsquo;s entire vehicle market,
              <span className="text-sheen"> decoded.</span>
            </motion.h1>

            <motion.p variants={heroItemVariants} className="text-body-lg mx-auto mt-6 max-w-xl">
              <span className="font-bold text-foreground num">{marketPulseListings > 0 ? marketPulseListings.toLocaleString() : "120,000+"}</span> live listings from{" "}
              <span className="font-bold text-foreground num">{marketPulseSources || 10}</span> sources across{" "}
              <span className="font-bold text-foreground num">{marketPulseDistricts || 25}</span> districts — real-time pricing,
              deal scores, and the market intelligence dealers keep to themselves.
            </motion.p>

            <motion.div variants={heroItemVariants} className="mx-auto mt-4 flex justify-center">
              <DataFreshnessIndicator
                latestListingAt={liveMarketSnapshot?.latest_listing_at}
                lastUpdated={stats?.last_updated}
              />
            </motion.div>

            {/* Search (centered) */}
            <motion.div variants={heroItemVariants} className="mx-auto mt-8 max-w-2xl text-left">
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-card shadow-soft-lg backdrop-blur-md transition-all focus-within:border-primary/40 focus-within:shadow-gold-glow">
                    <Search aria-hidden className="ml-4 h-5 w-5 shrink-0 text-muted-foreground" />
                    <label htmlFor="hero-search" className="sr-only">{t("common.search", "Search")} vehicles</label>
                    <input
                      id="hero-search"
                      value={heroSearch}
                      onChange={(e) => { setHeroSearch(e.target.value); setHeroSearchMessage(null); setHeroActiveIdx(-1); }}
                      onFocus={() => { if (heroSuggestions.length) setHeroSuggestionsOpen(true); }}
                      onBlur={() => { window.setTimeout(() => { setHeroSuggestionsOpen(false); setHeroActiveIdx(-1); }, 120); }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown" && heroSuggestions.length) {
                          e.preventDefault();
                          setHeroSuggestionsOpen(true);
                          setHeroActiveIdx((i) => (i + 1) % heroSuggestions.length);
                        } else if (e.key === "ArrowUp" && heroSuggestions.length) {
                          e.preventDefault();
                          setHeroActiveIdx((i) => (i <= 0 ? heroSuggestions.length - 1 : i - 1));
                        } else if (e.key === "Escape") {
                          setHeroSuggestionsOpen(false);
                          setHeroActiveIdx(-1);
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          if (heroActiveIdx >= 0 && heroSuggestions[heroActiveIdx]) applyHeroSuggestion(heroSuggestions[heroActiveIdx]);
                          else runHeroSearch();
                        }
                      }}
                      placeholder="Toyota Aqua, Honda Vezel, Wagon R..."
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      role="combobox"
                      aria-expanded={showHeroSuggestions}
                      aria-controls="hero-suggestions"
                      aria-autocomplete="list"
                      aria-activedescendant={heroActiveIdx >= 0 ? `hero-suggestion-${heroActiveIdx}` : undefined}
                      type="search"
                      enterKeyHint="search"
                      className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground placeholder:text-muted-foreground outline-none [&::-webkit-search-cancel-button]:hidden"
                    />
                    <button type="button" onClick={runHeroSearch} className="mr-2 h-10 rounded-lg bg-primary px-6 text-[11px] font-bold uppercase tracking-[0.1em] text-white shadow-soft transition-all hover:bg-primary/95 active:scale-[0.97]">
                      {t("common.search", "Search")}
                    </button>
                  </div>

                  {showHeroSuggestions && (
                    <div id="hero-suggestions" role="listbox" className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card/95 p-1 shadow-soft-xl backdrop-blur-xl">
                      {heroSuggestionsLoading ? (
                        <p className="px-3 py-2 text-[11px] text-muted-foreground">{t("common.searching", "Searching...")}</p>
                      ) : heroSuggestions.length ? (
                        <div className="max-h-[240px] overflow-y-auto">
                          {heroSuggestions.map((s, idx) => (
                            <button
                              key={`${s.id}-${s.make}-${s.model}`} type="button" role="option"
                              id={`hero-suggestion-${idx}`}
                              aria-selected={idx === heroActiveIdx}
                              onMouseDown={(e) => e.preventDefault()} onClick={() => applyHeroSuggestion(s)}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface ${idx === heroActiveIdx ? "bg-surface" : ""}`}
                            >
                              <span className="text-[13px] font-bold text-foreground">{s.make} {s.model} {s.year}</span>
                              <span className="text-[12px] font-bold text-primary-bright num">
                                {isReasonableListingPrice(Number(s.price_lkr)) ? formatPrice(s.price_lkr || null) : "—"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : <p className="px-3 py-2 text-[11px] text-muted-foreground">No matches.</p>}
                    </div>
                  )}
                </div>

                {heroSearchMessage && (
                  <p className="mt-2 text-[11px] font-medium text-primary-bright">{heroSearchMessage}</p>
                )}

                {/* Quick scans */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">Popular</span>
                  {([
                    { label: "Toyota Aqua", make: "Toyota", model: "Aqua" },
                    { label: "Honda Vezel", make: "Honda", model: "Vezel" },
                    { label: "Wagon R", make: "Suzuki", model: "Wagon R" },
                    { label: "Nissan Leaf", make: "Nissan", model: "Leaf" },
                    { label: "Toyota Axio", make: "Toyota", model: "Axio" },
                  ] as const).map((item) => (
                    <button key={item.label} type="button"
                      onClick={() => { setHeroSearch(item.label); focusModel(item.make, item.model); }}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-all hover:border-primary/40 hover:bg-surface hover:text-foreground active:scale-[0.97]"
                    >{item.label}</button>
                  ))}
                </div>
            </motion.div>
          </div>

          {/* ── Full-width live intelligence console ── */}
          <div className="mt-12 lg:mt-16">
            <MarketIntelligencePanel snapshot={liveMarketSnapshot} stats={stats} insights={dashboardInsights} />
          </div>
        </motion.div>
      </section>

      {/* ── INVENTORY ───────────────────────────────────────────── */}
      {/* Market pulse showcase: curated proof-of-inventory above the grid */}
      <RevealSection className="border-t border-border">
        <div className="mx-auto max-w-[1560px] px-5 py-14 sm:px-6 lg:py-20">
          <SectionHeader eyebrow="Market pulse" title={"What’s moving right now"} />
          <div className="grid gap-10 lg:grid-cols-3">

            {/* Trending models */}
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground">Trending models</h3>
                <Link to="/trends" className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground no-underline transition-colors hover:text-primary-bright">
                  All trends <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {trendingModels.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {trendingModels.slice(0, 4).map((row) => (
                    <button key={`${row.make}-${row.model}`} type="button" onClick={() => focusModel(row.make, row.model)}
                      className="group/trend flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-all hover:border-primary/30 hover:bg-card hover:shadow-soft active:scale-[0.99]"
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black/30">
                        <VehicleThumbnail src={row.thumbnail_url} alt={`${row.make} ${row.model}`} className="w-full h-full object-cover" placeholderClassName="flex h-full w-full items-center justify-center bg-black/20" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-foreground">{row.make} {row.model}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground num">{row.listing_count.toLocaleString()} listed · avg {formatPrice(row.avg_price_lkr)}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover/trend:translate-x-0.5 group-hover/trend:text-primary" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Awaiting data</p>
              )}
            </div>

            {/* Hot deals */}
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <Flame className="h-4 w-4 text-primary/70" /> Best deals
                </h3>
                <Link to="/best-picks" className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground no-underline transition-colors hover:text-primary-bright">
                  All picks <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {hotDeals.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {hotDeals.slice(0, 4).map((row) => (
                    <Link key={row.id} to={`/listing/${row.id}`}
                      className="group/deal flex items-center gap-3 rounded-xl border border-border bg-surface p-3 no-underline transition-all hover:border-primary/30 hover:bg-card hover:shadow-soft active:scale-[0.99]"
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black/30">
                        <VehicleThumbnail src={row.thumbnail_url} listingId={row.id} alt={`${row.make} ${row.model}`} className="w-full h-full object-cover" placeholderClassName="flex h-full w-full items-center justify-center bg-black/20" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-foreground">{row.make} {row.model} {row.year}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground num">{formatPrice(row.price_lkr)} · {row.district || "LK"}</p>
                      </div>
                      <span className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 num">
                        +{Number(row.deal_score || 0).toFixed(0)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">No deals found in current slice</p>
              )}
            </div>
            {/* Price cuts (7d) */}
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-emerald-400/80" /> Price cuts &middot; 7d
                </h3>
                <Link to="/best-picks" className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground no-underline transition-colors hover:text-primary-bright">
                  All cuts <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {(dropsQuery.data || []).length ? (
                <div className="grid gap-2">
                  {(dropsQuery.data || []).slice(0, 4).map((drop) => (
                    <Link key={drop.listing.id} to={`/listing/${drop.listing.id}`}
                      className="group/drop flex items-center gap-3 rounded-xl border border-border bg-surface p-3 no-underline transition-all hover:border-primary/30 hover:bg-card hover:shadow-soft active:scale-[0.99]"
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black/30">
                        <VehicleThumbnail src={drop.listing.thumbnail_url} listingId={drop.listing.id} alt={`${drop.listing.make} ${drop.listing.model}`} className="w-full h-full object-cover" placeholderClassName="flex h-full w-full items-center justify-center bg-black/20" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-foreground">{drop.listing.make} {drop.listing.model}{drop.listing.year ? ` ${drop.listing.year}` : ""}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground num">
                          <span className="line-through">{formatPrice(drop.previous_price_lkr)}</span>{" "}
                          <span className="font-semibold text-foreground">{formatPrice(drop.new_price_lkr)}</span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 num">
                        &minus;{drop.drop_pct}%
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">No cuts caught in the last 7 days &mdash; tracking is scan-over-scan.</p>
              )}
            </div>
          </div>
        </div>
      </RevealSection>

      <section id="market" className="scroll-mt-20">
        <div className="mx-auto max-w-[1560px] px-5 py-8 sm:px-6 lg:py-10">

          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:gap-2.5">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {isPriceUnavailableMode ? t("common.unpricedInventory", "Unpriced inventory") : t("common.inventory", "Inventory")}
                </h2>
                {loadingListings ? (
                  <span className="inline-block h-4 w-14 animate-pulse rounded bg-foreground/[0.03]" aria-hidden />
                ) : (
                  <span className="text-[13px] font-medium text-muted-foreground num" aria-live="polite">
                    {total.toLocaleString()}
                    {!isPriceUnavailableMode && activeFilterLabels.length === 0 ? (
                      <span className="ml-1 text-muted-foreground">priced</span>
                    ) : null}
                  </span>
                )}
              </div>
              {listingFreshnessAt ? (
                <DataFreshnessIndicator
                  latestListingAt={liveMarketSnapshot?.latest_listing_at}
                  lastUpdated={stats?.last_updated}
                  variant="subline"
                  className="normal-case tracking-normal"
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowSavedListings(true)}
                className="rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >{watchlistIds.length} {t("common.saved", "saved")}</button>
              <button type="button" onClick={saveCurrentMarketAlert}
                className="rounded-md border border-primary/15 bg-primary/5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-bright transition-colors hover:bg-primary/10"
              >{t("common.saveAlert", "Save alert")}</button>
              <button type="button" onClick={() => setShowMarketAlerts(true)}
                className="rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
              >{marketAlerts.length} {t("common.alerts", "alerts")}</button>
              <div className="hidden items-center gap-0.5 md:flex">
                <button type="button" onClick={() => setMarketView("grid")} aria-label="Grid view" aria-pressed={marketView === "grid"}
                  className={`h-8 w-8 rounded-md border transition-colors flex items-center justify-center ${marketView === "grid" ? "border-border bg-foreground/[0.03] text-foreground" : "border-transparent text-muted-foreground hover:text-muted-foreground"}`}
                ><LayoutGrid className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setMarketView("list")} aria-label="List view" aria-pressed={marketView === "list"}
                  className={`h-8 w-8 rounded-md border transition-colors flex items-center justify-center ${marketView === "list" ? "border-border bg-foreground/[0.03] text-foreground" : "border-transparent text-muted-foreground hover:text-muted-foreground"}`}
                ><List className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          {/* Active filters */}
          {activeFilterLabels.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {activeFilterLabels.map((label) => (
                <span key={label} className="rounded-md border border-border bg-foreground/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
              ))}
              <button type="button" onClick={() => setFilters({ sort: "newest", page: 1, vehicle_category: "cars" })}
                className="rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >Clear all</button>
            </div>
          )}

          {newLiveListingsAvailable && (
            <div className="mb-5 flex items-center justify-between rounded-lg border border-primary/15 bg-primary/5 px-4 py-2.5">
              <span className="text-[12px] font-semibold text-primary-bright">New listings available</span>
              <button type="button" onClick={() => { setFilters((p) => ({ ...p, sort: "newest", page: 1 })); setNewLiveListingsAvailable(false); }}
                className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary-bright transition-colors hover:text-primary-bright"
              >Refresh</button>
            </div>
          )}

          <DataFreshnessIndicator
            latestListingAt={liveMarketSnapshot?.latest_listing_at}
            lastUpdated={stats?.last_updated}
            variant="banner"
            className="mb-5"
          />

          {/* Filters + Grid */}
          <div className="flex flex-col items-start gap-6 lg:flex-row">
            <div className="w-full shrink-0 self-start lg:sticky lg:top-20 lg:w-[300px]">
              <FilterSidebar filters={filters} onFiltersChange={setFilters} />
            </div>

            <div className="min-w-0 flex-1">
              {loadingListings ? (
                <div className={marketView === "grid" ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
                  {Array.from({ length: marketView === "grid" ? 9 : 6 }).map((_, i) => (
                    <ListingCardSkeleton key={`skel-${i}`} />
                  ))}
                </div>
              ) : listingsFailed ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-20 text-center">
                  <p className="text-sm text-muted-foreground">
                    Listings temporarily unavailable — market API returned an error.
                  </p>
                  <button
                    type="button"
                    onClick={retryListings}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-primary/30 hover:text-primary-bright"
                  >
                    Retry
                  </button>
                </div>
              ) : listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">No results</p>
                  <p className="mt-2 text-sm text-muted-foreground">Widen your filters or clear them to browse.</p>
                  <button type="button" onClick={() => setFilters({ sort: "newest", page: 1, vehicle_category: "cars" })}
                    className="mt-4 rounded-lg border border-border px-4 py-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.03]"
                  >Reset filters</button>
                </div>
              ) : marketView === "grid" ? (
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={cardContainerVariants}
                  className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                  {listings.map((listing) => (
                    <motion.div key={listing.id} variants={cardItemVariants}>
                      <ListingCard listing={listing} onCompareToggle={toggleCompare} isComparing={compareIdSet.has(listing.id)} onWatchlistToggle={toggleWatchlist} isWatchlisted={watchlistIdSet.has(listing.id)} />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={cardContainerVariants}
                  className="space-y-2"
                >
                  {listings.map((listing) => {
                    const hasPrice = isReasonableListingPrice(Number(listing.price_lkr));
                    return (
                      <motion.div key={listing.id} variants={cardItemVariants}>
                        <Link to={`/listing/${listing.id}`} className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-3 no-underline transition-all hover:border-primary/30 hover:bg-card hover:shadow-soft active:scale-[0.99]">
                          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black/30">
                            <VehicleThumbnail src={pickVehicleImageUrl([listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])], [listing.detail_url])} listingId={listing.id} alt={`${listing.make} ${listing.model}`} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors">{listing.make} {listing.model} {listing.variant || ""}</p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{listing.year || "N/A"} · {listing.district || "N/A"} · {listing.source}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {hasPrice ? (
                              <p className="text-[14px] font-bold text-foreground num">{formatPrice(Number(listing.price_lkr))}</p>
                            ) : <PriceUnavailableBadge label="N/A" className="text-[10px]" />}
                            {listing.deal_score != null && (
                              <p className={`mt-0.5 text-[10px] font-bold num ${Number(listing.deal_score) >= 0 ? "text-primary-bright" : "text-muted-foreground"}`}>
                                {Number(listing.deal_score) >= 0 ? "+" : ""}{Number(listing.deal_score).toFixed(0)} deal
                              </p>
                            )}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                  <p className="text-[11px] text-muted-foreground">
                    <span className="num text-foreground">{(filters.page - 1) * LISTINGS_PAGE_SIZE + 1}–{Math.min(filters.page * LISTINGS_PAGE_SIZE, total)}</span> of {total.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button type="button" aria-label="Previous page" disabled={filters.page <= 1} onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    ><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <span className="px-2 text-[11px] font-semibold text-muted-foreground num">{filters.page} / {totalPages}</span>
                    <button type="button" aria-label="Next page" disabled={filters.page >= totalPages} onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    ><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKET PULSE ────────────────────────────────────────── */}
      <RevealSection className="border-t border-border">
        <div className="mx-auto max-w-[1560px] px-5 py-14 sm:px-6 lg:py-20">
          <SectionHeader eyebrow="Deeper intelligence" title="Fuel mix, market signals & regional momentum" />
          <div className="space-y-6">
            <FuelMixStrip />
            <MarketSignalsStrip />
          </div>

          {/* District demand velocity */}
          <div className="mt-12 border-t border-border pt-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-bright">Demand velocity</p>
                <h3 className="mt-1 font-display text-base font-semibold tracking-tight text-foreground">
                  Regional listing momentum — last 7 days
                </h3>
              </div>
              <Link
                to="/#market"
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground no-underline transition-colors hover:text-primary-bright"
              >
                Market feed <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <Suspense
              fallback={
                <div className="h-[420px] rounded-xl border border-border bg-card flex items-center justify-center">
                  <div aria-hidden className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-emerald-500 animate-spin" />
                </div>
              }
            >
              <div className="space-y-4">
                <ProvinceVelocityStrip
                  data={velocityPoints}
                  isLoading={velocityQuery.isPending}
                  isError={velocityQuery.isError}
                  onRetry={retryVelocity}
                />
                <DistrictVelocityMap
                  data={velocityPoints}
                  isLoading={velocityQuery.isPending}
                  isError={velocityQuery.isError}
                  onRetry={retryVelocity}
                />
              </div>
            </Suspense>
          </div>

          {/* Tool links */}
          <div className="mt-12 border-t border-border pt-8">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Intelligence tools</p>
            <div className="flex flex-wrap gap-2">
            {[
              { label: "Valuation", to: "/estimate" },
              { label: "Trends", to: "/trends" },
              { label: "Calculator", to: "/calculator" },
              { label: "EV Hub", to: "/ev-hub" },
              { label: "Official Pulse", to: "/official-pulse" },
            ].map((tool) => (
              <Link key={tool.label} to={tool.to}
                className="group/tool flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-[12px] font-semibold text-foreground no-underline transition-all hover:border-primary/30 hover:bg-primary/[0.06] hover:shadow-soft active:scale-[0.98]"
              >
                {tool.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-all group-hover/tool:text-primary group-hover/tool:translate-x-0.5" />
              </Link>
            ))}
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ── MOBILE QUICK FILTER BUTTON ──────────────────────────── */}
      <button
        type="button"
        aria-label="Open quick filters"
        onClick={() => setShowMobileFilter(true)}
        className="md:hidden fixed bottom-[4.75rem] right-4 z-[1100] flex h-12 items-center gap-2 rounded-full border border-border bg-card/95 pl-3.5 pr-4 shadow-soft-xl backdrop-blur-xl transition-all hover:bg-card active:scale-95"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <span className="text-[12px] font-semibold text-foreground">Filters</span>
        {activeFilterLabels.length > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
            {activeFilterLabels.length}
          </span>
        )}
      </button>

      {/* ── COMPARE BAR ─────────────────────────────────────────── */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-[1200] w-[min(94vw,680px)] -translate-x-1/2">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-soft-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Scale className="h-4 w-4 text-primary/60" />
              <span className="text-[12px] font-semibold text-foreground">{compareIds.length} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCompareListings([])}
                className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              ><X className="h-3 w-3" /> Clear</button>
              <button type="button" disabled={compareIds.length < 2} onClick={() => setShowCompare(true)}
                className="h-8 rounded-lg bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-primary/95 disabled:opacity-40"
              >Compare</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIALOGS ─────────────────────────────────────────────── */}
      <Dialog open={showMarketAlerts} onOpenChange={setShowMarketAlerts}>
        <DialogContent className="max-h-[86vh] max-w-2xl overflow-y-auto rounded-xl border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">Market alerts</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Current lane</p>
            <p className="mt-1.5 text-[13px] font-semibold text-foreground">{currentAlertSummary}</p>
            <div className="mt-3 flex gap-2">
              <Input value={alertPriceInput} onChange={(e) => setAlertPriceInput(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Target max price (LKR)" className="h-9 flex-1 rounded-lg border-border bg-transparent text-base md:text-sm" />
              <button type="button" onClick={saveCurrentMarketAlert} className="h-9 rounded-lg bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-white hover:bg-primary/95">Save</button>
            </div>
          </div>
          {marketAlerts.length ? (
            <div className="space-y-1.5">
              {marketAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{alert.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{alert.target_price_lkr ? `Under ${formatPrice(alert.target_price_lkr)}` : "New listings"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { setFilters({ ...(alert.filters as FilterState), sort: alert.filters.sort || "newest", page: 1 }); setShowMarketAlerts(false); scrollToMarket(); }}
                      className="h-7 rounded-md border border-primary/15 bg-primary/5 px-2.5 text-[10px] font-semibold text-primary-bright hover:bg-primary/10">Open</button>
                    <button type="button" onClick={() => deleteMarketAlert(alert.id)}
                      className="h-7 rounded-md border border-border px-2.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="py-6 text-center text-[11px] text-muted-foreground">No alerts saved</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={showSavedListings} onOpenChange={setShowSavedListings}>
        <DialogContent className="max-h-[86vh] max-w-2xl overflow-y-auto rounded-xl border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">Saved listings</DialogTitle>
          </DialogHeader>
          {savedListingsLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-lg" />)}</div>
          ) : savedListings.length ? (
            <div className="space-y-1.5">
              {savedListings.map((listing) => (
                <div key={listing.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{listing.make} {listing.model} {listing.year || ""}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{listing.district || "LK"} · {isReasonableListingPrice(Number(listing.price_lkr || 0)) ? formatPrice(listing.price_lkr) : "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => toggleWatchlist(listing)} className="h-7 rounded-md border border-primary/15 bg-primary/5 px-2.5 text-[10px] font-semibold text-primary-bright hover:bg-primary/10">Remove</button>
                    <Link to={`/listing/${listing.id}`} onClick={() => setShowSavedListings(false)} className="flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[10px] font-semibold text-muted-foreground no-underline hover:text-foreground">
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="py-6 text-center text-[11px] text-muted-foreground">No saved listings</p>}
          {savedListingsError && <p className="text-[11px] text-primary-bright">{savedListingsError}</p>}
        </DialogContent>
      </Dialog>

      <MobileFilterSheet
        open={showMobileFilter}
        onOpenChange={setShowMobileFilter}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <ComparisonModal listings={comparedListings} open={showCompare} onClose={() => setShowCompare(false)} />
    </div>
  );
}
