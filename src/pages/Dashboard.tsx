import { lazy, startTransition, Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterState, CarListing, DistrictPrice, DashboardInsights, DistrictQuickInsight, PriceTrendPoint } from "@/types/car";
import { 
  getStats, getListings, getDistrictPrices, getMakes, getModels,
  getPriceTrendSeries, formatPrice, getDashboardInsights, getDistrictQuickInsight, LISTINGS_PAGE_SIZE
} from "@/services/api";
import { usePipelineStatus } from "@/hooks/usePipelineStatus";
import { useLiveMarketSnapshot } from "@/hooks/useLiveMarketSnapshot";
import { ListingCard } from "@/components/ListingCard";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { MarketPredictor } from "@/components/MarketPredictor";
import { ComparisonModal } from "@/components/ComparisonModal";
import { FilterSidebar } from "@/components/FilterSidebar";
import { PipelineStatusBar } from "@/components/PipelineStatusBar";
import { PlatformPageHero } from "@/components/PlatformPageHero";
import { AmbientBackground } from "@/components/AmbientBackground";
import { SectionHeader } from "@/components/SectionHeader";
import { RevealSection } from "@/components/RevealSection";
import { DecisionIntelligenceGrid } from "@/components/DecisionIntelligenceGrid";
import { Surface } from "@/components/Surface";
import { BadgeDelta } from "@/components/ui/badge-delta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Calculator,
  Car,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  ExternalLink,
  Flame,
  Gauge,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  MapPinned,
  Radio,
  Scale,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import type { StatsOverview } from "@/types/car";
import {
  getListing,
  getListingSearchSuggestions,
  type ListingSearchSuggestion,
} from "@/services/api";
import { loadWatchlistIds, saveWatchlistIds, toggleWatchlistId } from "@/lib/watchlist";
import { pickVehicleImageUrl } from "@/lib/listingImage";
import { isReasonableListingPrice } from "@/lib/formatting";
import { VehicleThumbnail } from "@/components/VehicleThumbnail";
import { PriceUnavailableBadge } from "@/components/PriceUnavailableBadge";
import { ListingCardSkeleton } from "@/components/ListingCardSkeleton";
import { loadMarketAlerts, removeMarketAlert, saveMarketAlert, summarizeAlertFilters, type MarketAlert } from "@/lib/marketAlerts";

const LazyMarketMap = lazy(() => import("@/components/MarketMap").then((m) => ({ default: m.MarketMap })));

const SORT_VALUES = ["newest", "deal_score", "price_asc", "price_desc", "mileage_asc"] as const;

function parseOptionalNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isSortValue(value: string | null): value is FilterState["sort"] {
  return value !== null && (SORT_VALUES as readonly string[]).includes(value);
}

function formatFreshnessLabel(value: string | null | undefined): string {
  if (!value) return "Live refresh pending";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "Live refresh pending";

  const elapsedMinutes = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (elapsedMinutes < 1) return "Updated just now";
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes}m ago`;

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Updated ${elapsedHours}h ago`;

  return `Updated ${new Date(value).toLocaleDateString("en-LK")}`;
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
    price_availability: priceAvailability === "unavailable" ? "unavailable" : undefined,
    sort: isSortValue(sort) ? sort : "newest",
    page: Math.max(1, parseOptionalNumber(params.get("page")) || 1),
  };
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => {
    return parseFilters(searchParams);
  });

  useEffect(() => {
    const nextFilters = parseFilters(searchParams);
    setFilters((prev) => {
      const keys = Object.keys(nextFilters) as (keyof FilterState)[];
      const changed = keys.some((k) => prev[k] !== nextFilters[k]);
      return changed ? nextFilters : prev;
    });
  }, [searchParams]);

  // Global Data
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [districtPrices, setDistrictPrices] = useState<DistrictPrice[]>([]);
  const [listings, setListings] = useState<CarListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingListings, setLoadingListings] = useState(true);
  const pipelineStatus = usePipelineStatus();
  const liveMarketSnapshot = useLiveMarketSnapshot();
  const [dashboardInsights, setDashboardInsights] = useState<DashboardInsights | null>(null);
  const [districtQuickInsight, setDistrictQuickInsight] = useState<DistrictQuickInsight | null>(null);
  const [loadingDistrictInsight, setLoadingDistrictInsight] = useState(false);

  // Make options (powers hero search matching + quick valuation model chips)
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);

  // Price History Tracking
  const [trendMakes, setTrendMakes] = useState<{ make: string; count: number }[]>([]);
  const [trendModels, setTrendModels] = useState<{ model: string; count: number }[]>([]);
  const [trendMake, setTrendMake] = useState("");
  const [trendModel, setTrendModel] = useState("");
  const [trendData, setTrendData] = useState<PriceTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendCoverageNote, setTrendCoverageNote] = useState<string | null>(null);

  const districtTrendSeed = useMemo(() => {
    if (!filters.district) return null;
    const match = districtPrices.find((point) => point.district === filters.district);
    if (!match?.top_make || !match?.top_model) return null;
    return { make: match.top_make, model: match.top_model };
  }, [districtPrices, filters.district]);

  const [compareListings, setCompareListings] = useState<CarListing[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<number[]>([]);
  const [heroSearch, setHeroSearch] = useState("");
  const [heroSearchMessage, setHeroSearchMessage] = useState<string | null>(null);
  const [heroSuggestions, setHeroSuggestions] = useState<ListingSearchSuggestion[]>([]);
  const [heroSuggestionsOpen, setHeroSuggestionsOpen] = useState(false);
  const [heroSuggestionsLoading, setHeroSuggestionsLoading] = useState(false);
  const [showSavedListings, setShowSavedListings] = useState(false);
  const [savedListings, setSavedListings] = useState<CarListing[]>([]);
  const [savedListingsLoading, setSavedListingsLoading] = useState(false);
  const [savedListingsError, setSavedListingsError] = useState<string | null>(null);
  const [marketView, setMarketView] = useState<"grid" | "list">("grid");
  const [marketModels, setMarketModels] = useState<{ model: string; count: number }[]>([]);
  const [quickValuationModel, setQuickValuationModel] = useState("");
  const [quickValuationResult, setQuickValuationResult] = useState<{
    estimateLabel: string;
    sampleSize: number;
  } | null>(null);
  const [newLiveListingsAvailable, setNewLiveListingsAvailable] = useState(false);
  const [marketAlerts, setMarketAlerts] = useState<MarketAlert[]>([]);
  const [showMarketAlerts, setShowMarketAlerts] = useState(false);
  const [alertPriceInput, setAlertPriceInput] = useState("");
  const liveListingAtRef = useRef<string | null>(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [marketDataUnavailable, setMarketDataUnavailable] = useState(false);

  // FETCH CORE DATA
  useEffect(() => {
    getStats()
      .then((data) => {
        setStats(data);
        setMarketDataUnavailable(false);
      })
      .catch(() => setMarketDataUnavailable(true));
    setLoadingMap(true);
    getDistrictPrices()
      .then(setDistrictPrices)
      .catch(() => {})
      .finally(() => setLoadingMap(false));
    getMakes().then((m) => { setMakes(m); setTrendMakes(m); }).catch(() => {});
    setWatchlistIds(loadWatchlistIds());
    setMarketAlerts(loadMarketAlerts());
  }, []);

  useEffect(() => {
    const refreshInsights = () => {
      getDashboardInsights().then(setDashboardInsights).catch(() => {});
    };

    refreshInsights();
    const interval = window.setInterval(refreshInsights, 120_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    saveWatchlistIds(watchlistIds);
  }, [watchlistIds]);

  useEffect(() => {
    const query = heroSearch.trim();
    if (!query) {
      setHeroSuggestions([]);
      setHeroSuggestionsOpen(false);
      setHeroSuggestionsLoading(false);
      setHeroSearchMessage(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setHeroSuggestionsLoading(true);
      getListingSearchSuggestions(query, 8)
        .then((rows) => {
          if (cancelled) return;
          setHeroSuggestions(rows);
          setHeroSuggestionsOpen(true);
          setHeroSearchMessage(null);
        })
        .catch(() => {
          if (cancelled) return;
          setHeroSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) {
            setHeroSuggestionsLoading(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [heroSearch]);

  useEffect(() => {
    if (!showSavedListings) return;

    if (!watchlistIds.length) {
      setSavedListings([]);
      setSavedListingsError(null);
      setSavedListingsLoading(false);
      return;
    }

    let cancelled = false;
    setSavedListingsLoading(true);
    setSavedListingsError(null);

    Promise.all(
      watchlistIds.map(async (savedId) => {
        try {
          return await getListing(savedId);
        } catch {
          return null;
        }
      }),
    )
      .then((rows) => {
        if (cancelled) return;

        const availableById = new Map<number, CarListing>();
        rows.forEach((row) => {
          if (row?.id) {
            availableById.set(row.id, row);
          }
        });

        const hydrated = watchlistIds
          .map((savedId) => availableById.get(savedId))
          .filter((row): row is CarListing => Boolean(row));

        setSavedListings(hydrated);

        if (!hydrated.length) {
          setSavedListingsError("Saved listings are currently unavailable from live sources.");
        } else if (hydrated.length < watchlistIds.length) {
          setSavedListingsError("Some saved listings are no longer available in source feeds.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSavedListings([]);
        setSavedListingsError("Unable to load saved listings right now.");
      })
      .finally(() => {
        if (!cancelled) {
          setSavedListingsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showSavedListings, watchlistIds]);

  useEffect(() => {
    if (!filters.district) {
      setDistrictQuickInsight(null);
      return;
    }

    setLoadingDistrictInsight(true);
    getDistrictQuickInsight(filters.district)
      .then(setDistrictQuickInsight)
      .catch(() => setDistrictQuickInsight(null))
      .finally(() => setLoadingDistrictInsight(false));
  }, [filters.district]);

  const fetchListings = useCallback(async () => {
    setLoadingListings(true);
    try {
      const result = await getListings(filters);
      setListings(result.listings);
      setTotal(result.total);
    } catch {
      setListings([]);
      setTotal(0);
    } finally {
      setLoadingListings(false);
    }
  }, [filters]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  useEffect(() => {
    const latestListingAt = liveMarketSnapshot?.latest_listing_at || null;
    if (!latestListingAt) return;

    const previous = liveListingAtRef.current;
    liveListingAtRef.current = latestListingAt;
    if (!previous || previous === latestListingAt) return;

    getStats().then(setStats).catch(() => {});
    getDashboardInsights().then(setDashboardInsights).catch(() => {});

    if (filters.page === 1 && filters.sort === "newest") {
      fetchListings();
      setNewLiveListingsAvailable(false);
    } else {
      setNewLiveListingsAvailable(true);
    }
  }, [fetchListings, filters.page, filters.sort, liveMarketSnapshot?.latest_listing_at]);

  // Sync URL
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
    if (filters.price_availability === "unavailable") params.set("price_availability", filters.price_availability);
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    if (filters.page > 1) params.set("page", String(filters.page));

    const nextSearch = params.toString();
    const currentSearch = searchParams.toString();
    if (nextSearch === currentSearch) {
      return;
    }

    setSearchParams(params, { replace: true });
  }, [filters, searchParams, setSearchParams]);

  // QUICK VALUATION — model chips for the make currently in play
  useEffect(() => {
    if (!filters.make) {
      setMarketModels([]);
      return;
    }

    getModels(filters.make)
      .then(setMarketModels)
      .catch(() => setMarketModels([]));
  }, [filters.make]);

  // TRENDS LOGIC
  useEffect(() => {
    if (!trendMake) return;
    setTrendModel("");
    getModels(trendMake)
      .then(setTrendModels)
      .catch(() => setTrendModels([]));
  }, [trendMake]);

  useEffect(() => {
    if (filters.make) {
      if (trendMake !== filters.make) {
        setTrendMake(filters.make);
      }
      return;
    }

    if (filters.district && districtTrendSeed?.make) {
      if (trendMake !== districtTrendSeed.make) {
        setTrendMake(districtTrendSeed.make);
      }
      return;
    }

    if (!trendMake && trendMakes.length > 0) {
      setTrendMake(trendMakes[0].make);
    }
  }, [districtTrendSeed, filters.district, filters.make, trendMake, trendMakes]);

  useEffect(() => {
    if (!trendModels.length) return;

    if (filters.model && trendModels.some((item) => item.model === filters.model)) {
      if (trendModel !== filters.model) {
        setTrendModel(filters.model);
      }
      return;
    }

    if (
      filters.district &&
      districtTrendSeed?.make === trendMake &&
      districtTrendSeed?.model &&
      trendModels.some((item) => item.model === districtTrendSeed.model)
    ) {
      if (trendModel !== districtTrendSeed.model) {
        setTrendModel(districtTrendSeed.model);
      }
      return;
    }

    if (!trendModel) {
      setTrendModel(trendModels[0].model);
    }
  }, [districtTrendSeed, filters.district, filters.model, trendMake, trendModel, trendModels]);

  useEffect(() => {
    if (trendMake && trendModel) {
      setTrendLoading(true);
      getPriceTrendSeries(trendMake, trendModel, filters.condition, filters.district)
        .then((series) => {
          setTrendData(series.points);
          setTrendCoverageNote(series.coverage_note);
        })
        .catch(() => {
          setTrendData([]);
          setTrendCoverageNote("Historical trend stream is temporarily unavailable. Re-run shortly for trajectory analytics.");
        })
        .finally(() => { setTrendLoading(false); });
    }
  }, [trendMake, trendModel, filters.condition, filters.district]);

  const toggleCompare = useCallback((listing: CarListing) => {
    setCompareListings((prev) => {
      if (prev.some((item) => item.id === listing.id)) {
        return prev.filter((item) => item.id !== listing.id);
      }

      if (prev.length >= 3) {
        return prev;
      }

      return [...prev, listing];
    });
  }, []);

  const compareIds = useMemo(() => compareListings.map((listing) => listing.id), [compareListings]);
  const compareIdSet = useMemo(() => new Set(compareIds), [compareIds]);
  const watchlistIdSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const toggleWatchlist = useCallback((listing: CarListing) => {
    setWatchlistIds((prev) => toggleWatchlistId(prev, listing.id).ids);
  }, []);

  const scrollToMarket = useCallback(() => {
    document.getElementById("market")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyHeroSuggestion = useCallback(
    (suggestion: ListingSearchSuggestion) => {
      setHeroSearch(`${suggestion.make} ${suggestion.model}`);
      setHeroSuggestionsOpen(false);
      startTransition(() => {
        setFilters((prev) => ({
          ...prev,
          q: undefined,
          make: suggestion.make,
          model: suggestion.model,
          page: 1,
        }));
      });
      setHeroSearchMessage(null);
      scrollToMarket();
    },
    [scrollToMarket],
  );

  const runHeroSearch = useCallback(() => {
    const query = heroSearch.trim();
    if (!query) return;

    if (heroSuggestions.length > 0) {
      applyHeroSuggestion(heroSuggestions[0]);
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const makeMatch = makes.find((entry) => entry.make.toLowerCase().includes(normalizedQuery));
    const modelMatch = listings.find((listing) => {
      const makeModel = `${listing.make} ${listing.model}`.toLowerCase();
      return makeModel.includes(normalizedQuery);
    });

    startTransition(() => {
      setFilters((prev) => ({
        ...prev,
        q: query,
        make: makeMatch?.make ?? modelMatch?.make ?? prev.make,
        model: makeMatch ? undefined : modelMatch?.model ?? prev.model,
        page: 1,
      }));
    });

    setHeroSuggestionsOpen(false);
    setHeroSearchMessage(
      makeMatch || modelMatch
        ? null
        : "Searching the vehicle index only. If this is not a vehicle make, model, year, or listing title, the result set will stay empty.",
    );

    scrollToMarket();
  }, [applyHeroSuggestion, heroSearch, heroSuggestions, listings, makes, scrollToMarket]);

  const focusModel = useCallback(
    (make: string, model?: string) => {
      startTransition(() => {
        setFilters((prev) => ({
          ...prev,
          q: undefined,
          make,
          model: model || undefined,
          page: 1,
        }));
      });
      scrollToMarket();
    },
    [scrollToMarket],
  );

  const focusSegment = useCallback(
    (segment: string) => {
      startTransition(() => {
        setFilters((prev) => ({
          ...prev,
          q: undefined,
          body_type: segment as FilterState["body_type"],
          page: 1,
        }));
      });
      scrollToMarket();
    },
    [scrollToMarket],
  );

  const onDistrictSelect = useCallback((district: string) => {
    startTransition(() => {
      setFilters((prev) => ({
        ...prev,
        district: prev.district === district ? undefined : district,
        page: 1,
      }));
    });
  }, []);

  const fallbackTrendingModels = useMemo(() => {
    const grouped = new Map<string, { make: string; model: string; count: number; avgPriceTotal: number; avgDealTotal: number; thumbnail?: string }>();

    listings.forEach((listing) => {
      const listingPrice = Number(listing.price_lkr || 0);
      if (!isReasonableListingPrice(listingPrice)) return;
      const key = `${listing.make}-${listing.model}`;
      const item = grouped.get(key);
      const image = listing.thumbnail_url || listing.images?.[0];

      if (item) {
        item.count += 1;
        item.avgPriceTotal += listingPrice;
        item.avgDealTotal += Number(listing.deal_score || 0);
        if (!item.thumbnail && image) {
          item.thumbnail = image;
        }
      } else {
        grouped.set(key, {
          make: listing.make,
          model: listing.model,
          count: 1,
          avgPriceTotal: listingPrice,
          avgDealTotal: Number(listing.deal_score || 0),
          thumbnail: image,
        });
      }
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        avgPrice: item.avgPriceTotal / item.count,
        movementPct: item.avgDealTotal / item.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [listings]);

  const fallbackHotDeals = useMemo(
    () =>
      [...listings]
        .filter((listing) => Number(listing.deal_score || 0) >= 8 && isReasonableListingPrice(Number(listing.price_lkr || 0)))
        .sort((a, b) => Number(b.deal_score || 0) - Number(a.deal_score || 0))
        .slice(0, 5),
    [listings],
  );

  const fallbackNewListingsToday = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 3_600_000;
    return listings.filter((listing) => {
      const base = listing.first_seen_at || listing.scraped_at;
      if (!base) return false;
      const ts = new Date(base).getTime();
      return Number.isFinite(ts) && ts >= oneDayAgo;
    }).length;
  }, [listings]);

  const fallbackSegmentPerformance = useMemo(() => {
    const grouped = new Map<string, { count: number; totalPrice: number; totalScore: number }>();

    listings.forEach((listing) => {
      const key = String(listing.body_type || "unknown").toLowerCase();
      const prev = grouped.get(key) || { count: 0, totalPrice: 0, totalScore: 0 };
      grouped.set(key, {
        count: prev.count + 1,
        totalPrice: prev.totalPrice + Number(listing.price_lkr || 0),
        totalScore: prev.totalScore + Number(listing.deal_score || 0),
      });
    });

    return Array.from(grouped.entries())
      .map(([segment, value]) => ({
        segment,
        listing_count: value.count,
        avg_price_lkr: value.count > 0 ? value.totalPrice / value.count : 0,
        change_pct_30d: value.count > 0 ? Number((value.totalScore / value.count).toFixed(1)) : null,
      }))
      .sort((a, b) => b.listing_count - a.listing_count)
      .slice(0, 6);
  }, [listings]);

  const segmentPerformance = dashboardInsights?.segment_performance?.length
    ? dashboardInsights.segment_performance
    : fallbackSegmentPerformance;

  const trendingModelRows = dashboardInsights?.trending_models?.length
    ? dashboardInsights.trending_models
    : fallbackTrendingModels.map((row) => ({
        make: row.make,
        model: row.model,
        listing_count: row.count,
        avg_price_lkr: row.avgPrice,
        movement_pct: row.movementPct,
        thumbnail_url: row.thumbnail || null,
      }));

  const normalizedTrendingRows = useMemo(
    () =>
      trendingModelRows.map((row) => ({
        ...row,
        thumbnail_url: pickVehicleImageUrl([row.thumbnail_url]),
      })),
    [trendingModelRows],
  );

  const runQuickValuation = useCallback(() => {
    const query = quickValuationModel.trim().toLowerCase();
    if (!query) {
      setQuickValuationResult(null);
      return;
    }

    const matchingPrices = listings
      .filter((item) => {
        const makeModel = `${item.make} ${item.model}`.toLowerCase();
        return makeModel.includes(query) && isReasonableListingPrice(Number(item.price_lkr));
      })
      .map((item) => Number(item.price_lkr))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    if (matchingPrices.length > 0) {
      const medianIndex = Math.floor(matchingPrices.length / 2);
      const median =
        matchingPrices.length % 2 === 0
          ? (matchingPrices[medianIndex - 1] + matchingPrices[medianIndex]) / 2
          : matchingPrices[medianIndex];

      setQuickValuationResult({
        estimateLabel: formatPrice(median),
        sampleSize: matchingPrices.length,
      });
      return;
    }

    const trendMatch = trendingModelRows.find((item) => {
      const makeModel = `${item.make} ${item.model}`.toLowerCase();
      return makeModel.includes(query) && Number(item.avg_price_lkr) > 0;
    });

    if (trendMatch) {
      setQuickValuationResult({
        estimateLabel: formatPrice(Number(trendMatch.avg_price_lkr)),
        sampleSize: Number(trendMatch.listing_count || 0),
      });
      return;
    }

    setQuickValuationResult({
      estimateLabel: "No direct model match yet",
      sampleSize: 0,
    });
  }, [listings, quickValuationModel, trendingModelRows]);

  const hotDealRows = dashboardInsights?.hot_deals?.length
    ? dashboardInsights.hot_deals.filter((row) => isReasonableListingPrice(Number(row.price_lkr || 0)))
    : fallbackHotDeals.map((row) => ({
        id: row.id,
        make: row.make,
        model: row.model,
        year: row.year,
        district: row.district || null,
        source: row.source,
        price_lkr: row.price_lkr,
        deal_score: Number(row.deal_score || 0),
        thumbnail_url: row.thumbnail_url || row.images?.[0] || null,
      }));

  const normalizedHotDeals = useMemo(
    () =>
      hotDealRows.map((row) => ({
        ...row,
        thumbnail_url: pickVehicleImageUrl([row.thumbnail_url]),
      })),
    [hotDealRows],
  );

  const comparedListings = useMemo(
    () => listings.filter((listing) => compareIdSet.has(listing.id)),
    [listings, compareIdSet],
  );

  const newListingsToday = dashboardInsights?.new_listings_24h ?? fallbackNewListingsToday;
  const spotlightModel = normalizedTrendingRows[0] ?? null;
  const spotlightDeal = normalizedHotDeals.find((row) => isReasonableListingPrice(Number(row.price_lkr || 0))) ?? null;
  const spotlightSegment = segmentPerformance[0] ?? null;
  const marketPulseFreshness = formatFreshnessLabel(liveMarketSnapshot?.latest_listing_at || stats?.last_updated);
  const marketPulseListings = Number(liveMarketSnapshot?.priced_listings ?? stats?.total_listings ?? total ?? 0);
  const marketPulseDistrictCoverage = Number(stats?.district_count || districtPrices.length || 0);
  const marketPulseSources = Number(stats?.source_count || liveMarketSnapshot?.source_status?.length || 0);
  const marketPulseHotDeals = normalizedHotDeals.length;
  const isPriceUnavailableMode = filters.price_availability === "unavailable";
  const averageIndexPrice = liveMarketSnapshot?.avg_price_lkr || stats?.avg_price_lkr
    ? formatPrice(liveMarketSnapshot?.avg_price_lkr ?? stats?.avg_price_lkr ?? null)
    : "Syncing";
  const momChange = Number(stats?.price_change_mom ?? 0);
  const momIsCooling = momChange < 0;
  const momChangeLabel = `${momChange >= 0 ? "+" : ""}${momChange.toFixed(1)}% MoM`;
  const marketSignalCards = [
    {
      label: "Listings",
      value: marketPulseListings.toLocaleString(),
      icon: Database,
    },
    {
      label: "Districts",
      value: marketPulseDistrictCoverage.toLocaleString(),
      icon: MapPinned,
    },
    {
      label: "Sources",
      value: marketPulseSources.toLocaleString(),
      icon: Radio,
    },
    {
      label: "Top deal",
      value: spotlightDeal ? `+${Number(spotlightDeal.deal_score || 0).toFixed(0)}` : marketPulseHotDeals.toLocaleString(),
      icon: Sparkles,
    },
  ];

  const totalPages = Math.ceil(total / LISTINGS_PAGE_SIZE);
  const currentAlertSummary = useMemo(() => summarizeAlertFilters(filters), [filters]);

  const saveCurrentMarketAlert = useCallback(() => {
    const targetPrice = Number(alertPriceInput.replace(/[^\d]/g, ""));
    const nextAlerts = saveMarketAlert(filters, Number.isFinite(targetPrice) ? targetPrice : undefined);
    setMarketAlerts(nextAlerts);
    setAlertPriceInput("");
    setShowMarketAlerts(true);
  }, [alertPriceInput, filters]);

  const deleteMarketAlert = useCallback((id: string) => {
    setMarketAlerts(removeMarketAlert(id));
  }, []);

  const activeFilterCount = useMemo(
    () =>
      [
        filters.q,
        filters.source,
        filters.make,
        filters.model,
        filters.district,
        filters.condition,
        filters.body_type,
        filters.transmission,
        filters.fuel_type,
        filters.price_availability,
        filters.year_min,
        filters.year_max,
        filters.price_min,
        filters.price_max,
        filters.mileage_max,
      ].filter(Boolean).length,
    [filters],
  );

  const activeFilterLabels = useMemo(
    () =>
      [
        filters.price_availability === "unavailable" ? "Missing-price queue" : undefined,
        filters.q ? `Keyword: ${filters.q}` : undefined,
        filters.source ? `Source: ${filters.source}` : undefined,
        filters.make,
        filters.model,
        filters.district,
        filters.condition ? filters.condition.replace(/_/g, " ") : undefined,
        filters.body_type,
        filters.fuel_type,
        filters.transmission,
        filters.price_min || filters.price_max ? "Budget range set" : undefined,
        filters.mileage_max ? `Under ${Math.round(filters.mileage_max / 1000)}k km` : undefined,
      ].filter(Boolean) as string[],
    [filters],
  );

  const marketModelOptions = useMemo(() => {
    if (marketModels.length) return marketModels;
    if (filters.model) return [{ model: filters.model, count: 0 }];
    return [];
  }, [filters.model, marketModels]);

  const showHeroSuggestions = (heroSuggestionsOpen || heroSuggestionsLoading) && heroSearch.trim().length > 0;
  const indexBoardLoading = !stats && !liveMarketSnapshot && !marketDataUnavailable;
  return (
    <>
      <div className="dashboard-shell">
        <AmbientBackground variant="hero" />
        <div className="relative z-[1]">
        {/* HERO — market cockpit */}
        <PlatformPageHero
          eyebrow="AutoLens LK"
          title="Know the real price before you call."
          description="Search live Sri Lanka listings, compare districts, and read fair-value signals in one calm workspace."
          icon={Sparkles}
          footer={
            <button
              type="button"
              onClick={() => document.getElementById("decision-intelligence")?.scrollIntoView({ behavior: "smooth" })}
              className="group flex flex-col items-center gap-2 text-zinc-500 transition-colors duration-300 hover:text-zinc-200"
              aria-label="Scroll to market tools"
            >
              <span className="tech-label">Explore market</span>
              <ChevronDown className="h-5 w-5 animate-scroll-hint" />
            </button>
          }
          aside={
            <Surface variant="glass" className="index-board-card p-4 sm:p-5" aria-label="Live market index board">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-eyebrow">Live index</p>
                  <h2 className="headline-display mt-2 text-lg sm:text-xl">Sri Lanka board</h2>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2 text-muted-foreground">
                  <Activity className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>

              {indexBoardLoading ? (
                <>
                  <div className="mt-5 border-y border-border py-5" aria-busy="true" aria-live="polite">
                    <p className="field-label normal-case tracking-normal">Median pressure</p>
                    <div className="skeleton-shimmer mt-3 h-10 w-44 rounded-md sm:h-11" />
                    <div className="skeleton-shimmer mt-4 h-6 w-28 rounded-full" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={`index-signal-skel-${index}`} className="data-card p-3">
                        <div className="skeleton-shimmer h-3 w-20 rounded" />
                        <div className="skeleton-shimmer mt-3 h-5 w-16 rounded" />
                      </div>
                    ))}
                  </div>
                </>
              ) : marketDataUnavailable && !stats && !liveMarketSnapshot ? (
                <div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-zinc-300">
                  <p className="font-semibold text-amber-200">Live market stats are unavailable right now.</p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    The pricing feed could not be reached. Search and listings may still load once the backend reconnects.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-5 border-y border-border py-5">
                    <p className="field-label normal-case tracking-normal">Median pressure</p>
                    <p className={`mt-2 font-bold leading-none text-white num ${averageIndexPrice === "Syncing" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-[2.75rem]"}`}>
                      {averageIndexPrice}
                    </p>
                    <BadgeDelta trend={momIsCooling ? "down" : "up"} className="mt-4">
                      {momChangeLabel}
                    </BadgeDelta>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {marketSignalCards.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="data-card p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="field-label normal-case tracking-normal">{item.label}</p>
                            <Icon className="h-4 w-4 text-zinc-500" />
                          </div>
                          <p className="mt-3 text-lg font-bold text-white num">{item.value}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <p className="mt-4 truncate text-xs text-muted-foreground">
                {liveMarketSnapshot?.active_scrape_sources?.length
                  ? `Syncing ${liveMarketSnapshot.active_scrape_sources.join(", ")}`
                  : marketPulseFreshness}
              </p>
            </Surface>
          }
        >
          <div id="overview" className="space-y-5">
            <div className="hero-search-panel p-2 md:p-2.5">
              <div className="flex min-w-0 flex-col gap-2 md:flex-row">
                <div className="relative min-w-0 flex-1 text-left">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-500" />
                  <label htmlFor="hero-vehicle-search" className="sr-only">
                    Search Sri Lanka vehicle listings
                  </label>
                  <Input
                    id="hero-vehicle-search"
                    value={heroSearch}
                    onChange={(event) => {
                      setHeroSearch(event.target.value);
                      setHeroSearchMessage(null);
                    }}
                    onFocus={() => {
                      if (heroSuggestions.length > 0) {
                        setHeroSuggestionsOpen(true);
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setHeroSuggestionsOpen(false), 120);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        runHeroSearch();
                      }
                    }}
                    placeholder="Toyota Aqua, Honda Vezel, Wagon R..."
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    role="combobox"
                    aria-expanded={showHeroSuggestions}
                    aria-controls="hero-search-suggestions"
                    className="h-12 min-w-0 w-full border-0 bg-transparent pl-11 pr-4 text-sm font-semibold text-white placeholder-zinc-600 shadow-none focus-visible:ring-0 sm:h-13 sm:text-base"
                  />
                </div>
                <Button
                  type="button"
                  onClick={runHeroSearch}
                  size="lg"
                  className="micro-press h-12 w-full rounded-lg px-8 sm:h-13 md:w-auto"
                >
                  Check price
                </Button>
              </div>

              {showHeroSuggestions && (
                <div
                  id="hero-search-suggestions"
                  role="listbox"
                  aria-label="Vehicle search suggestions"
                  className="asset-surface mt-2 rounded-[10px] text-left"
                >
                  {heroSuggestionsLoading ? (
                    <p className="px-4 py-3 text-xs font-semibold text-zinc-500">Searching...</p>
                  ) : heroSuggestions.length ? (
                    <div className="max-h-[260px] overflow-y-auto p-1.5">
                      {heroSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.id}-${suggestion.make}-${suggestion.model}`}
                          type="button"
                          role="option"
                          aria-selected="false"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyHeroSuggestion(suggestion)}
                          className="w-full rounded-[8px] border border-transparent px-3 py-3 text-left transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04] focus-visible:border-amber-300/50 focus-visible:outline-none"
                        >
                          <span className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-zinc-100">
                              {suggestion.make} {suggestion.model} {suggestion.year}
                            </span>
                            <span className="text-xs font-bold text-amber-400 num">
                              {isReasonableListingPrice(Number(suggestion.price_lkr)) ? formatPrice(suggestion.price_lkr || null) : "No price"}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-zinc-500">
                            {suggestion.district || "Sri Lanka"} · {suggestion.source}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-xs font-semibold text-zinc-500">No matches yet.</p>
                  )}
                </div>
              )}
            </div>

            {heroSearchMessage ? (
              <p className="rounded-[10px] border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-100">
                {heroSearchMessage}
              </p>
            ) : null}

            <div className="flex max-w-full flex-wrap items-center gap-2 text-caption font-semibold">
              <span className="tech-label">Quick scans</span>
              {["Toyota Aqua", "Honda Vezel", "Suzuki Wagon R", "Nissan Leaf", "Toyota Axio", "BMW"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setHeroSearch(item)}
                  className="micro-press rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {item}
                </button>
              ))}
            </div>

          </div>
        </PlatformPageHero>

        <DecisionIntelligenceGrid />

      <div className="flex flex-col">

      {/* MAP SECTION */}
      <RevealSection id="map" className="layout-shell order-3 py-12 text-left lg:py-16">
        <SectionHeader eyebrow="Geo intelligence" title="Market concentration" />
        <div className="console-section p-4 md:p-5">
           <Suspense
             fallback={
               <div className="skeleton-shimmer flex h-[420px] w-full items-center justify-center rounded-xl border border-white/[0.05] text-sm font-semibold text-zinc-500">
                 Loading geo intelligence...
               </div>
             }
           >
             <LazyMarketMap
               isLoading={loadingMap}
               data={districtPrices}
               selectedDistrict={filters.district}
               onDistrictSelect={onDistrictSelect}
             />
           </Suspense>
        </div>
              </RevealSection>

        {/* MARKET TRENDS — price history + valuation/predictor modules */}
        <RevealSection id="trends" className="layout-shell order-4 flex flex-col gap-6 py-12 text-left lg:py-16">
          <SectionHeader eyebrow="Market trends" title="Price history" />

          <div className="console-section p-4 sm:p-5 md:p-6">
            <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <div className="headline-kicker text-zinc-400">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                  Trend controls
                </div>
                <h3 className="text-lg font-semibold text-foreground">Pick a lane</h3>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="trend-make" className="field-label flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                  Trend make
                </label>
                <Select
                  value={trendMake || undefined}
                  onValueChange={(value) => {
                    setTrendMake(value);
                    setTrendModel("");
                  }}
                >
                  <SelectTrigger id="trend-make" className="control-dark w-full">
                    <SelectValue placeholder="Choose a make" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-white/10 text-zinc-100">
                    {trendMakes.map((row) => (
                      <SelectItem key={row.make} value={row.make}>
                        {row.make} ({row.count.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="trend-model" className="field-label flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                  Trend model
                </label>
                <Select
                  value={trendModel || undefined}
                  onValueChange={setTrendModel}
                  disabled={!trendMake || trendModels.length === 0}
                >
                  <SelectTrigger id="trend-model" className="control-dark w-full disabled:opacity-60">
                    <SelectValue placeholder="Choose a model" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-white/10 text-zinc-100">
                    {trendModels.map((row) => (
                      <SelectItem key={row.model} value={row.model}>
                        {row.model} ({row.count.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <span className="field-label mr-1 text-zinc-500">Active lane</span>
              <span className="status-chip">{trendMake || "No make"}</span>
              <span className="status-chip">{trendModel || "No model"}</span>
              <span className="status-chip">District: {filters.district || "All Sri Lanka"}</span>
              <span className="status-chip">Condition: {filters.condition ? filters.condition.replace(/_/g, " ") : "Any"}</span>
            </div>
          </div>

          <PriceHistoryChart
            title={`${filters.district || "Sri Lanka"} ${trendMake && trendModel ? `- ${trendMake} ${trendModel}` : "Market"}`}
            points={trendData}
            isLoading={trendLoading}
            coverageNote={trendCoverageNote}
            emptyMessage={
              !trendMake || !trendModel
                ? "Select a make and model to load live history."
                : "Trend samples are still being collected for this vehicle lane."
            }
            emptyActionLabel={filters.district || filters.condition ? "Show broader lane" : undefined}
            onEmptyAction={
              filters.district || filters.condition
                ? () => setFilters((prev) => ({ ...prev, district: undefined, condition: undefined, page: 1 }))
                : undefined
            }
          />
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
            <MarketPredictor trendData={trendData} listingsToday={newListingsToday} />

            {/* Quick valuation — instant fair-price read from live priced inventory */}
            <div className="console-section p-5 md:p-6">
              <header className="mb-5 flex items-center gap-3 border-b border-border pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <Calculator className="h-5 w-5 text-amber-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="tech-label">Quick valuation</p>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">Instant fair-price read</h3>
                </div>
              </header>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="quick-valuation" className="field-label">Make / model</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="quick-valuation"
                      value={quickValuationModel}
                      onChange={(event) => setQuickValuationModel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          runQuickValuation();
                        }
                      }}
                      placeholder="Toyota Axio, Honda Vezel, BMW 320d..."
                      className="control-dark flex-1"
                    />
                    <button
                      type="button"
                      onClick={runQuickValuation}
                      className="action-primary h-11 px-5 sm:w-auto"
                    >
                      <Gauge className="h-4 w-4" aria-hidden="true" />
                      Calculate
                    </button>
                  </div>
                </div>

                {marketModelOptions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="field-label mr-1 text-zinc-500">
                      {filters.make ? `Models in ${filters.make}` : "Suggested"}
                    </span>
                    {marketModelOptions.slice(0, 6).map((option) => (
                      <button
                        key={option.model}
                        type="button"
                        onClick={() => setQuickValuationModel([filters.make, option.model].filter(Boolean).join(" "))}
                        className="status-chip transition-colors hover:border-amber-300/45 hover:text-white"
                      >
                        {option.model}
                      </button>
                    ))}
                  </div>
                )}

                <div className="data-card p-4">
                  {quickValuationResult ? (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="field-label">Fair market read</p>
                        <p className="num mt-1 text-2xl font-semibold tracking-tight text-foreground">{quickValuationResult.estimateLabel}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {quickValuationResult.sampleSize > 0
                          ? `${quickValuationResult.sampleSize.toLocaleString()} listings`
                          : "Need more volume"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground">Type make/model for live median</p>
                    </div>
                  )}
                </div>

                <Link to="/estimate" className="action-soft h-10 w-full">
                  Open full valuation workbench
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* MARKET INTELLIGENCE — spotlight signals + district snapshot */}
        <RevealSection id="intelligence" className="layout-shell order-3 flex flex-col gap-6 py-12 text-left lg:py-16">
          <SectionHeader eyebrow="Market intelligence" title="Spotlight signals" />

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Demand leader */}
            <article className="console-section flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="tech-label">Demand leader</p>
                <TrendingUp className="h-4 w-4 text-amber-400" aria-hidden="true" />
              </div>
              {spotlightModel ? (
                <>
                  <div className="aspect-[16/10] overflow-hidden rounded-lg border border-border bg-card">
                    <VehicleThumbnail
                      src={spotlightModel.thumbnail_url}
                      alt={`${spotlightModel.make} ${spotlightModel.model}`}
                      className="h-full w-full object-cover"
                      placeholderClassName="flex h-full w-full items-center justify-center bg-card"
                    />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{spotlightModel.make} {spotlightModel.model}</p>
                    <p className="mt-1 num text-xs text-zinc-400">{spotlightModel.listing_count.toLocaleString()} listings · avg {formatPrice(spotlightModel.avg_price_lkr)}</p>
                    <p className={`mt-1 num text-xs font-bold ${(spotlightModel.movement_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {(spotlightModel.movement_pct || 0) >= 0 ? "+" : ""}{(spotlightModel.movement_pct || 0).toFixed(1)} trend score
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => focusModel(spotlightModel.make, spotlightModel.model)}
                    className="action-soft mt-auto h-10 w-full"
                  >
                    Filter to this model
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Awaiting sync</p>
              )}
            </article>

            {/* Best live deal */}
            <article className="console-section flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="tech-label">Best live deal</p>
                <Flame className="h-4 w-4 text-amber-400" aria-hidden="true" />
              </div>
              {spotlightDeal ? (
                <>
                  <div className="aspect-[16/10] overflow-hidden rounded-lg border border-border bg-card">
                    <VehicleThumbnail
                      src={spotlightDeal.thumbnail_url}
                      listingId={spotlightDeal.id}
                      alt={`${spotlightDeal.make} ${spotlightDeal.model}`}
                      className="h-full w-full object-cover"
                      placeholderClassName="flex h-full w-full items-center justify-center bg-card"
                    />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{spotlightDeal.make} {spotlightDeal.model} {spotlightDeal.year}</p>
                    <p className="mt-1 num text-xs text-zinc-400">{formatPrice(spotlightDeal.price_lkr)} · {spotlightDeal.district || "Sri Lanka"}</p>
                    <p className="mt-1 num text-xs font-bold text-emerald-400">+{Number(spotlightDeal.deal_score || 0).toFixed(0)} deal score</p>
                  </div>
                  <Link to={`/listing/${spotlightDeal.id}`} className="action-soft mt-auto h-10 w-full">
                    Open listing
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No match in slice</p>
              )}
            </article>

            {/* Segment momentum */}
            <article className="console-section flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="tech-label">Segment momentum</p>
                <Layers className="h-4 w-4 text-amber-400" aria-hidden="true" />
              </div>
              {spotlightSegment ? (
                <>
                  <div className="metric-tile">
                    <p className="text-xl font-semibold capitalize text-white">{spotlightSegment.segment}</p>
                    <p className="mt-1 num text-xs text-zinc-400">{spotlightSegment.listing_count.toLocaleString()} listings · avg {formatPrice(spotlightSegment.avg_price_lkr)}</p>
                    <p className={`mt-1 num text-xs font-bold ${(spotlightSegment.change_pct_30d || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {(spotlightSegment.change_pct_30d || 0) >= 0 ? "+" : ""}{(spotlightSegment.change_pct_30d || 0).toFixed(1)}% vs previous 30d
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => focusSegment(spotlightSegment.segment)}
                    className="action-soft h-10 w-full"
                  >
                    Filter to this segment
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {segmentPerformance.length > 1 && (
                    <div className="space-y-2">
                      {segmentPerformance.slice(1, 4).map((segment) => (
                        <button
                          key={segment.segment}
                          type="button"
                          onClick={() => focusSegment(segment.segment)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-amber-300/35"
                        >
                          <span className="truncate text-xs font-semibold capitalize text-zinc-200">{segment.segment}</span>
                          <span className="tech-label text-zinc-500">{segment.listing_count.toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Awaiting listings</p>
              )}
            </article>
          </div>

          {/* District snapshot */}
          <div className="console-section p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <p className="tech-label">District snapshot</p>
              </div>
              {filters.district ? <span className="status-chip">{filters.district}</span> : null}
            </div>

            {filters.district ? (
              loadingDistrictInsight ? (
                <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-live="polite">
                  <div className="skeleton-shimmer h-32 rounded-lg border border-border" />
                  <div className="space-y-2">
                    <div className="skeleton-shimmer h-9 rounded-lg border border-border" />
                    <div className="skeleton-shimmer h-9 rounded-lg border border-border" />
                    <div className="skeleton-shimmer h-9 rounded-lg border border-border" />
                  </div>
                </div>
              ) : districtQuickInsight ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="metric-tile">
                    <p className="text-lg font-semibold text-white">{districtQuickInsight.district}</p>
                    <p className="mt-1 num text-xs text-zinc-400">{districtQuickInsight.listing_count.toLocaleString()} active listings</p>
                    <p className="mt-1 num text-sm font-semibold text-zinc-200">Avg {districtQuickInsight.avg_price_lkr ? formatPrice(districtQuickInsight.avg_price_lkr) : "N/A"}</p>
                    <p className={`mt-1 num text-xs font-bold ${(districtQuickInsight.change_pct_30d || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {(districtQuickInsight.change_pct_30d || 0) >= 0 ? "+" : ""}{(districtQuickInsight.change_pct_30d || 0).toFixed(1)}% over last 30d
                    </p>
                  </div>
                  {districtQuickInsight.top_models.length > 0 ? (
                    <div className="space-y-2">
                      {districtQuickInsight.top_models.map((item) => (
                        <button
                          key={`${item.make}-${item.model}`}
                          type="button"
                          onClick={() => focusModel(item.make, item.model)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-amber-300/35"
                        >
                          <span className="truncate text-xs font-semibold text-zinc-200">{item.make} {item.model}</span>
                          <span className="tech-label text-zinc-500">{item.listing_count.toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No models yet</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No district data</p>
              )
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                Select a district on the map above to unlock a localized demand and pricing snapshot.
              </div>
            )}
          </div>
        </RevealSection>

      {/* LIVE MARKET INVENTORY */}
      <RevealSection id="market" className="order-2 mx-auto w-full max-w-[1560px] px-5 py-14 text-left sm:px-6 lg:py-16">
          <SectionHeader
            eyebrow="Live inventory"
            title={isPriceUnavailableMode ? "Price unavailable inventory" : "Priced inventory"}
            actions={
              <div className="flex flex-wrap items-center gap-2 tech-label">
                <div className="status-chip num">{total} total</div>
                <button
                  type="button"
                  onClick={() => setShowSavedListings(true)}
                  className="action-soft h-9 px-3 num"
                >
                  {watchlistIds.length} saved
                </button>
                <button
                  type="button"
                  onClick={saveCurrentMarketAlert}
                  className="action-primary h-9 px-3"
                >
                  Save alert
                </button>
                <button
                  type="button"
                  onClick={() => setShowMarketAlerts(true)}
                  className="action-soft h-9 px-3 num"
                >
                  {marketAlerts.length} alerts
                </button>
              </div>
            }
          />

        
        <div className="flex flex-col items-start gap-8 lg:flex-row">
          <div className="w-full shrink-0 self-start lg:sticky lg:top-24 lg:w-[336px]">
            <FilterSidebar filters={filters} onFiltersChange={setFilters} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="command-surface mb-5 rounded-xl p-3 sm:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="tech-label">Result desk</p>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {isPriceUnavailableMode ? "Unavailable-price results" : "Market matches"}
                  <span className="text-zinc-500 text-sm ml-2">({total} cars)</span>
                </h3>
              </div>
              <div className="hidden items-center gap-1.5 md:inline-flex">
                <button
                  type="button"
                  onClick={() => setMarketView("grid")}
                  aria-label="Grid view"
                  aria-pressed={marketView === "grid"}
                  className={`action-soft h-9 w-9 px-0 ${marketView === "grid" ? "border-amber-300/45 text-white" : ""}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMarketView("list")}
                  aria-label="List view"
                  aria-pressed={marketView === "list"}
                  className={`action-soft h-9 w-9 px-0 ${marketView === "list" ? "border-amber-300/45 text-white" : ""}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              </div>
              {activeFilterLabels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeFilterLabels.slice(0, 8).map((label) => (
                    <span key={label} className="status-chip">
                      {label}
                    </span>
                  ))}
                  {activeFilterCount > 8 && (
                    <span className="status-chip border-amber-300/30 bg-amber-500/10 text-amber-100">
                      +{activeFilterCount - 8} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {newLiveListingsAvailable && (
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">New scraped listings are available for this view.</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, sort: "newest", page: 1 }));
                    setNewLiveListingsAvailable(false);
                  }}
                  className="h-9 rounded-lg border border-amber-300/30 bg-black/20 px-3 text-xs font-bold uppercase tracking-[0.12em] text-amber-100"
                >
                  Refresh listings
                </button>
              </div>
            )}

            <div className="space-y-8">
          {loadingListings ? (
            <div className={marketView === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"}>
              {Array.from({ length: marketView === "grid" ? 9 : 6 }).map((_, index) => (
                <ListingCardSkeleton key={`skel-${index}`} />
              ))}
            </div>
          ) : marketView === "grid" ? (
            <div
              className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                  >
                    <ListingCard
                      listing={listing}
                      onCompareToggle={toggleCompare}
                      isComparing={compareIdSet.has(listing.id)}
                      onWatchlistToggle={toggleWatchlist}
                      isWatchlisted={watchlistIdSet.has(listing.id)}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((listing) => {
                const hasKnownPrice = isReasonableListingPrice(Number(listing.price_lkr));
                return (
                  <article
                    key={listing.id}
                    className="asset-surface motion-card rounded-xl p-3 hover:border-amber-300/25 hover:bg-[#101312] md:p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <Link to={`/listing/${listing.id}`} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                        <div className="h-[72px] w-28 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/25">
                          <VehicleThumbnail
                            src={pickVehicleImageUrl([listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])], [listing.detail_url])}
                            listingId={listing.id}
                            alt={`${listing.make} ${listing.model}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">{listing.make} {listing.model} {listing.variant || ""}</p>
                          <p className="mt-1 truncate text-xs text-zinc-400">
                            {listing.year || "N/A"} · {Number.isFinite(listing.mileage_km) ? `${Math.round(Number(listing.mileage_km) / 1000)}k km` : "Mileage N/A"} · {listing.district || "District N/A"} · {listing.source}
                          </p>
                          <p className="mt-2 hidden tech-label text-zinc-600 sm:block">
                            Open source record and peer context
                          </p>
                        </div>
                      </Link>

                      <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
                        <div className="min-w-[120px] text-left md:text-right">
                          {hasKnownPrice ? (
                            <p className="text-sm md:text-base font-semibold text-white num">{formatPrice(Number(listing.price_lkr))}</p>
                          ) : (
                            <PriceUnavailableBadge label="Price unavailable" className="px-2 py-1 text-label" />
                          )}
                          <p className={`text-caption font-semibold num ${Number(listing.deal_score || 0) >= 0 ? "text-amber-300" : "text-zinc-500"}`}>
                            {Number(listing.deal_score || 0) >= 0 ? "+" : ""}{Number(listing.deal_score || 0).toFixed(0)} deal score
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleWatchlist(listing)}
                          className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${watchlistIdSet.has(listing.id) ? "border-amber-400/35 text-amber-100 bg-amber-500/10" : "border-white/15 text-zinc-200 bg-black/20 hover:bg-white/[0.06]"}`}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCompare(listing)}
                          className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${compareIdSet.has(listing.id) ? "border-amber-400/40 text-amber-100 bg-amber-500/12" : "border-white/15 text-zinc-200 bg-black/20 hover:bg-white/[0.06]"}`}
                        >
                          Compare
                        </button>
                        <Link to={`/listing/${listing.id}`} className="inline-flex h-9 items-center rounded-lg border border-white/15 px-3 text-xs font-semibold text-zinc-200 no-underline transition-colors hover:bg-white/[0.06]">
                          Open
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loadingListings && listings.length === 0 && (
            <div className="console-empty">
              <p className="mb-2 tech-label text-zinc-500">No Matches Found</p>
              <h3 className="mb-2 text-2xl font-semibold text-white">No vehicles match the current filters.</h3>
              <p className="mx-auto mb-5 max-w-xl text-zinc-400">
                Widen your range or clear filters to browse more inventory.
              </p>
              <button
                type="button"
                onClick={() => setFilters({ sort: "newest", page: 1 })}
                className="action-soft h-10 px-4"
              >
                Reset Filters
              </button>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="field-label text-zinc-500">
                Showing <span className="text-white num">{(filters.page - 1) * LISTINGS_PAGE_SIZE + 1}-{Math.min(filters.page * LISTINGS_PAGE_SIZE, total)}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  className="action-soft h-10 w-10 px-0 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="status-chip num h-10">{filters.page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={filters.page >= totalPages}
                  onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="action-soft h-10 w-10 px-0 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
        </div>
      </RevealSection>

      {/* PIPELINE STATUS */}
      <RevealSection id="pipeline" className="layout-shell order-5 py-8">
        <PipelineStatusBar status={pipelineStatus} />
      </RevealSection>
      </div>
      </div>

      {compareIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-[1200] w-[min(94vw,780px)] -translate-x-1/2">
          <div className="premium-surface flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/15 text-amber-300">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Compare Vehicles</p>
                <p className="tech-label">
                  {compareIds.length} selected · add up to 3
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCompareListings([])}
                className="h-9 rounded-lg border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
              <Button
                disabled={compareIds.length < 2}
                onClick={() => setShowCompare(true)}
                className="h-9 rounded-lg bg-[#e0aa48] font-bold text-black hover:bg-[#f1c66d]"
              >
                Compare Now
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showMarketAlerts} onOpenChange={setShowMarketAlerts}>
        <DialogContent className="command-surface max-h-[86vh] max-w-3xl overflow-y-auto rounded-xl border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-normal">Market Alerts</DialogTitle>
          </DialogHeader>

          <div className="data-card p-4">
            <p className="tech-label text-amber-100/80">Current search lane</p>
            <p className="mt-2 text-sm font-semibold text-white">{currentAlertSummary}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                value={alertPriceInput}
                onChange={(event) => setAlertPriceInput(event.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="Optional target max price in LKR"
                aria-label="Optional alert target price"
                className="h-10 rounded-lg border-white/10 bg-black/25 text-sm text-zinc-100"
              />
              <Button
                onClick={saveCurrentMarketAlert}
                className="h-10 rounded-lg bg-[#e0aa48] px-4 text-xs font-bold uppercase tracking-[0.12em] text-black hover:bg-[#f1c66d]"
              >
                Save alert
              </Button>
            </div>
          </div>

          {marketAlerts.length ? (
            <div className="space-y-2">
              {marketAlerts.map((alert) => (
                <article key={alert.id} className="data-card p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{alert.label}</p>
                      <p className="mt-1 tech-label text-zinc-500">
                        {alert.target_price_lkr ? `Target under ${formatPrice(alert.target_price_lkr)}` : "New listings and price movement"} · saved {new Date(alert.created_at).toLocaleDateString("en-LK")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFilters({ ...(alert.filters as FilterState), sort: alert.filters.sort || "newest", page: 1 });
                          setShowMarketAlerts(false);
                          scrollToMarket();
                        }}
                        className="h-8 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 text-caption font-semibold text-amber-100"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMarketAlert(alert.id)}
                        className="h-8 rounded-lg border border-white/10 bg-black/20 px-3 ui-caption font-semibold hover:bg-white/[0.06]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="console-empty">
              <p className="tech-label">No alerts saved</p>
              <p className="text-sm text-zinc-300 mt-2">Save a search lane to return to it when new inventory arrives.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showSavedListings} onOpenChange={setShowSavedListings}>
        <DialogContent className="command-surface max-h-[86vh] max-w-3xl overflow-y-auto rounded-xl border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-normal">Saved Listings</DialogTitle>
          </DialogHeader>

          {savedListingsLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: Math.max(2, Math.min(4, watchlistIds.length || 2)) }).map((_, index) => (
                <div key={`saved-skel-${index}`} className="skeleton-shimmer h-20 rounded-xl border border-white/10" />
              ))}
            </div>
          ) : savedListings.length ? (
            <div className="space-y-2">
              {savedListings.map((listing) => (
                <article key={listing.id} className="data-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{listing.make} {listing.model} {listing.year || ""}</p>
                      <p className="tech-label mt-1 truncate">
                        {listing.district || "Sri Lanka"} · {listing.source} · {isReasonableListingPrice(Number(listing.price_lkr || 0)) ? formatPrice(listing.price_lkr) : "Price unavailable"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleWatchlist(listing)}
                        className="h-8 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 text-caption font-semibold text-amber-100"
                      >
                        Remove
                      </button>
                      <Link
                        to={`/listing/${listing.id}`}
                        onClick={() => setShowSavedListings(false)}
                        className="h-8 inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 text-caption font-semibold text-zinc-200 no-underline hover:bg-white/[0.06]"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="console-empty">
              <p className="tech-label">Saved list empty</p>
              <p className="text-sm text-zinc-300 mt-2">Tap Save on any listing to pin it here for quick access.</p>
            </div>
          )}

          {savedListingsError && (
            <p className="text-caption font-semibold text-amber-300">{savedListingsError}</p>
          )}
        </DialogContent>
      </Dialog>

      <ComparisonModal listings={comparedListings} open={showCompare} onClose={() => setShowCompare(false)} />
    </div>
    </>
  );
}


