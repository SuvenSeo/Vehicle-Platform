import { startTransition, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterState, CarListing, DashboardInsights } from "@/types/car";
import {
  getStats, getListings, getMakes,
  formatPrice, getDashboardInsights, LISTINGS_PAGE_SIZE
} from "@/services/api";
import { useLiveMarketSnapshot } from "@/hooks/useLiveMarketSnapshot";
import { ListingCard } from "@/components/ListingCard";
import { ComparisonModal } from "@/components/ComparisonModal";
import { FilterSidebar } from "@/components/FilterSidebar";
import { MarketIntelligencePanel } from "@/components/MarketIntelligencePanel";
import { RevealSection } from "@/components/RevealSection";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
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

  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [listings, setListings] = useState<CarListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingListings, setLoadingListings] = useState(true);
  const liveMarketSnapshot = useLiveMarketSnapshot();
  const [dashboardInsights, setDashboardInsights] = useState<DashboardInsights | null>(null);
  const [makes, setMakes] = useState<{ make: string; count: number }[]>([]);
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
  const [newLiveListingsAvailable, setNewLiveListingsAvailable] = useState(false);
  const [marketAlerts, setMarketAlerts] = useState<MarketAlert[]>([]);
  const [showMarketAlerts, setShowMarketAlerts] = useState(false);
  const [alertPriceInput, setAlertPriceInput] = useState("");
  const liveListingAtRef = useRef<string | null>(null);
  const [marketDataUnavailable, setMarketDataUnavailable] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────

  useEffect(() => {
    getStats()
      .then((data) => { setStats(data); setMarketDataUnavailable(false); })
      .catch(() => setMarketDataUnavailable(true));
    getMakes().then(setMakes).catch(() => {});
    setWatchlistIds(loadWatchlistIds());
    setMarketAlerts(loadMarketAlerts());
  }, []);

  useEffect(() => {
    const refresh = () => { getDashboardInsights().then(setDashboardInsights).catch(() => {}); };
    refresh();
    const interval = window.setInterval(refresh, 120_000);
    return () => window.clearInterval(interval);
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

  const fetchListings = useCallback(async () => {
    setLoadingListings(true);
    try { const result = await getListings(filters); setListings(result.listings); setTotal(result.total); }
    catch { setListings([]); setTotal(0); }
    finally { setLoadingListings(false); }
  }, [filters]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  useEffect(() => {
    const latestAt = liveMarketSnapshot?.latest_listing_at || null;
    if (!latestAt) return;
    const previous = liveListingAtRef.current;
    liveListingAtRef.current = latestAt;
    if (!previous || previous === latestAt) return;
    getStats().then(setStats).catch(() => {});
    getDashboardInsights().then(setDashboardInsights).catch(() => {});
    if (filters.page === 1 && filters.sort === "newest") { fetchListings(); setNewLiveListingsAvailable(false); }
    else setNewLiveListingsAvailable(true);
  }, [fetchListings, filters.page, filters.sort, liveMarketSnapshot?.latest_listing_at]);

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
    document.getElementById("market")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyHeroSuggestion = useCallback((s: ListingSearchSuggestion) => {
    setHeroSearch(`${s.make} ${s.model}`);
    setHeroSuggestionsOpen(false);
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

  const comparedListings = useMemo(() => listings.filter((l) => compareIdSet.has(l.id)), [listings, compareIdSet]);
  const totalPages = Math.ceil(total / LISTINGS_PAGE_SIZE);
  const currentAlertSummary = useMemo(() => summarizeAlertFilters(filters), [filters]);

  const saveCurrentMarketAlert = useCallback(() => {
    const target = Number(alertPriceInput.replace(/[^\d]/g, ""));
    const next = saveMarketAlert(filters, Number.isFinite(target) ? target : undefined);
    setMarketAlerts(next); setAlertPriceInput(""); setShowMarketAlerts(true);
  }, [alertPriceInput, filters]);

  const deleteMarketAlert = useCallback((id: string) => { setMarketAlerts(removeMarketAlert(id)); }, []);

  const activeFilterLabels = useMemo(
    () => [
      filters.price_availability === "unavailable" ? "Missing prices" : undefined,
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

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section id="overview" className="relative overflow-hidden border-b border-white/[0.04]">
        {/* ambient gold wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 55% at 50% -12%, rgba(212,164,68,0.12), transparent 60%), radial-gradient(ellipse 70% 50% at 50% 120%, rgba(66,174,208,0.04), transparent 55%)",
          }}
        />
        <div className="mx-auto max-w-[1560px] px-5 py-12 sm:px-6 sm:py-16 lg:py-20">
          {/* ── Centered editorial headline ── */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.02] px-3.5 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--gold)] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                  Vehicle Intelligence · Sri Lanka
                </p>
              </div>
            </div>

            <h1 className="mx-auto mt-6 max-w-3xl text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-[3.5rem] lg:text-[4.5rem]">
              Sri Lanka&rsquo;s entire vehicle market,
              <span className="bg-gradient-to-r from-[var(--gold-bright)] to-[var(--gold)] bg-clip-text text-transparent"> decoded.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-zinc-400 sm:text-[16px]">
              <span className="font-semibold text-zinc-200 num">{marketPulseListings.toLocaleString()}</span> live listings from{" "}
              <span className="font-semibold text-zinc-200 num">{marketPulseSources || 10}</span> sources across{" "}
              <span className="font-semibold text-zinc-200 num">{marketPulseDistricts || 25}</span> districts — real-time pricing,
              deal scores, and the market intelligence dealers keep to themselves.
            </p>

            {/* Search (centered) */}
            <div className="mx-auto mt-8 max-w-2xl text-left">
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[hsl(220,8%,6%)] shadow-lg transition-all focus-within:border-amber-400/30 focus-within:shadow-[0_0_0_3px_rgba(212,164,68,0.08),0_8px_32px_rgba(0,0,0,0.5)]">
                    <Search className="ml-4 h-5 w-5 shrink-0 text-zinc-500" />
                    <label htmlFor="hero-search" className="sr-only">Search vehicles</label>
                    <input
                      id="hero-search"
                      value={heroSearch}
                      onChange={(e) => { setHeroSearch(e.target.value); setHeroSearchMessage(null); }}
                      onFocus={() => { if (heroSuggestions.length) setHeroSuggestionsOpen(true); }}
                      onBlur={() => { window.setTimeout(() => setHeroSuggestionsOpen(false), 120); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runHeroSearch(); } }}
                      placeholder="Toyota Aqua, Honda Vezel, Wagon R..."
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      role="combobox"
                      aria-expanded={showHeroSuggestions}
                      aria-controls="hero-suggestions"
                      className="h-14 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder-zinc-600 outline-none"
                    />
                    <button type="button" onClick={runHeroSearch} className="mr-2 h-10 rounded-lg bg-[var(--gold)] px-6 text-[11px] font-bold uppercase tracking-[0.1em] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors hover:bg-[var(--gold-bright)]">
                      Search
                    </button>
                  </div>

                  {showHeroSuggestions && (
                    <div id="hero-suggestions" role="listbox" className="absolute inset-x-0 top-full z-50 mt-1.5 rounded-xl border border-white/[0.08] bg-[hsl(220,8%,6%)] p-1 shadow-xl">
                      {heroSuggestionsLoading ? (
                        <p className="px-3 py-2 text-[11px] text-zinc-600">Searching...</p>
                      ) : heroSuggestions.length ? (
                        <div className="max-h-[240px] overflow-y-auto">
                          {heroSuggestions.map((s) => (
                            <button
                              key={`${s.id}-${s.make}-${s.model}`} type="button" role="option" aria-selected="false"
                              onMouseDown={(e) => e.preventDefault()} onClick={() => applyHeroSuggestion(s)}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                            >
                              <span className="text-[13px] font-semibold text-zinc-200">{s.make} {s.model} {s.year}</span>
                              <span className="text-[12px] font-bold text-amber-400/80 num">
                                {isReasonableListingPrice(Number(s.price_lkr)) ? formatPrice(s.price_lkr || null) : "—"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : <p className="px-3 py-2 text-[11px] text-zinc-600">No matches.</p>}
                    </div>
                  )}
                </div>

                {heroSearchMessage && (
                  <p className="mt-2 text-[11px] font-medium text-amber-300/70">{heroSearchMessage}</p>
                )}

                {/* Quick scans */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">Popular</span>
                  {["Toyota Aqua", "Honda Vezel", "Wagon R", "Nissan Leaf", "Toyota Axio"].map((item) => (
                    <button key={item} type="button" onClick={() => setHeroSearch(item)}
                      className="rounded-md border border-white/[0.06] bg-white/[0.015] px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-amber-400/20 hover:text-zinc-200"
                    >{item}</button>
                  ))}
                </div>
            </div>
          </div>

          {/* ── Full-width live intelligence console ── */}
          <div className="mt-12 lg:mt-16">
            <MarketIntelligencePanel snapshot={liveMarketSnapshot} stats={stats} insights={dashboardInsights} />
          </div>
        </div>
      </section>

      {/* ── INVENTORY ───────────────────────────────────────────── */}
      <section id="market" className="scroll-mt-20">
        <div className="mx-auto max-w-[1560px] px-5 py-8 sm:px-6 lg:py-10">

          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {isPriceUnavailableMode ? "Unpriced inventory" : "Inventory"}
              </h2>
              {loadingListings ? (
                <span className="inline-block h-4 w-14 animate-pulse rounded bg-white/[0.06]" aria-hidden />
              ) : (
                <span className="text-[13px] font-medium text-zinc-400 num" aria-live="polite">
                  {total.toLocaleString()}
                  {!isPriceUnavailableMode && activeFilterLabels.length === 0 ? (
                    <span className="ml-1 text-zinc-600">priced</span>
                  ) : null}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowSavedListings(true)}
                className="rounded-md border border-white/[0.05] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 transition-colors hover:border-white/[0.1] hover:text-zinc-200"
              >{watchlistIds.length} saved</button>
              <button type="button" onClick={saveCurrentMarketAlert}
                className="rounded-md border border-amber-400/15 bg-amber-400/5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300/80 transition-colors hover:bg-amber-400/10"
              >Save alert</button>
              <button type="button" onClick={() => setShowMarketAlerts(true)}
                className="rounded-md border border-white/[0.05] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 transition-colors hover:text-zinc-300"
              >{marketAlerts.length} alerts</button>
              <div className="hidden items-center gap-0.5 md:flex">
                <button type="button" onClick={() => setMarketView("grid")} aria-label="Grid view" aria-pressed={marketView === "grid"}
                  className={`h-8 w-8 rounded-md border transition-colors flex items-center justify-center ${marketView === "grid" ? "border-white/[0.1] bg-white/[0.04] text-zinc-200" : "border-transparent text-zinc-600 hover:text-zinc-400"}`}
                ><LayoutGrid className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setMarketView("list")} aria-label="List view" aria-pressed={marketView === "list"}
                  className={`h-8 w-8 rounded-md border transition-colors flex items-center justify-center ${marketView === "list" ? "border-white/[0.1] bg-white/[0.04] text-zinc-200" : "border-transparent text-zinc-600 hover:text-zinc-400"}`}
                ><List className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          {/* Active filters */}
          {activeFilterLabels.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {activeFilterLabels.map((label) => (
                <span key={label} className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-400">{label}</span>
              ))}
              <button type="button" onClick={() => setFilters({ sort: "newest", page: 1 })}
                className="rounded-md px-2 py-1 text-[10px] font-semibold text-zinc-600 transition-colors hover:text-zinc-300"
              >Clear all</button>
            </div>
          )}

          {newLiveListingsAvailable && (
            <div className="mb-5 flex items-center justify-between rounded-lg border border-amber-400/15 bg-amber-400/5 px-4 py-2.5">
              <span className="text-[12px] font-semibold text-amber-200/80">New listings available</span>
              <button type="button" onClick={() => { setFilters((p) => ({ ...p, sort: "newest", page: 1 })); setNewLiveListingsAvailable(false); }}
                className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-300 transition-colors hover:text-amber-100"
              >Refresh</button>
            </div>
          )}

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
              ) : listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.05] py-20 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">No results</p>
                  <p className="mt-2 text-sm text-zinc-400">Widen your filters or clear them to browse.</p>
                  <button type="button" onClick={() => setFilters({ sort: "newest", page: 1 })}
                    className="mt-4 rounded-lg border border-white/[0.06] px-4 py-2 text-[11px] font-semibold text-zinc-300 transition-colors hover:bg-white/[0.03]"
                  >Reset filters</button>
                </div>
              ) : marketView === "grid" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} onCompareToggle={toggleCompare} isComparing={compareIdSet.has(listing.id)} onWatchlistToggle={toggleWatchlist} isWatchlisted={watchlistIdSet.has(listing.id)} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {listings.map((listing) => {
                    const hasPrice = isReasonableListingPrice(Number(listing.price_lkr));
                    return (
                      <Link key={listing.id} to={`/listing/${listing.id}`} className="group flex items-center gap-4 rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-3 no-underline transition-all hover:border-white/[0.08] hover:bg-[hsl(220,8%,6.5%)]">
                        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black/30">
                          <VehicleThumbnail src={pickVehicleImageUrl([listing.thumbnail_url, ...(Array.isArray(listing.images) ? listing.images : [])], [listing.detail_url])} listingId={listing.id} alt={`${listing.make} ${listing.model}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-foreground">{listing.make} {listing.model} {listing.variant || ""}</p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-500">{listing.year || "N/A"} · {listing.district || "N/A"} · {listing.source}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {hasPrice ? (
                            <p className="text-[14px] font-bold text-foreground num">{formatPrice(Number(listing.price_lkr))}</p>
                          ) : <PriceUnavailableBadge label="N/A" className="text-[10px]" />}
                          <p className={`mt-0.5 text-[10px] font-bold num ${Number(listing.deal_score || 0) >= 0 ? "text-amber-400/70" : "text-zinc-600"}`}>
                            {Number(listing.deal_score || 0) >= 0 ? "+" : ""}{Number(listing.deal_score || 0).toFixed(0)} deal
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between border-t border-white/[0.04] pt-6">
                  <p className="text-[11px] text-zinc-500">
                    <span className="num text-zinc-300">{(filters.page - 1) * LISTINGS_PAGE_SIZE + 1}–{Math.min(filters.page * LISTINGS_PAGE_SIZE, total)}</span> of {total.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.05] text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none"
                    ><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <span className="px-2 text-[11px] font-semibold text-zinc-400 num">{filters.page} / {totalPages}</span>
                    <button type="button" disabled={filters.page >= totalPages} onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.05] text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none"
                    ><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKET PULSE ────────────────────────────────────────── */}
      <RevealSection className="border-t border-white/[0.04]">
        <div className="mx-auto max-w-[1560px] px-5 py-14 sm:px-6 lg:py-20">
          <div className="mb-9 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--gold)]/70">Market pulse</p>
              <h2 className="mt-2 font-display text-[1.5rem] font-bold tracking-tight text-foreground sm:text-[1.875rem]">
                What&rsquo;s moving right now
              </h2>
            </div>
          </div>
          <div className="grid gap-10 lg:grid-cols-2">

            {/* Trending models */}
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground">Trending models</h3>
                <Link to="/trends" className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 no-underline transition-colors hover:text-amber-300">
                  All trends <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {trendingModels.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {trendingModels.slice(0, 4).map((row) => (
                    <button key={`${row.make}-${row.model}`} type="button" onClick={() => focusModel(row.make, row.model)}
                      className="group/trend flex items-center gap-3 rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-3 text-left transition-all hover:border-white/[0.08] hover:bg-[hsl(220,8%,6.5%)]"
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black/30">
                        <VehicleThumbnail src={row.thumbnail_url} alt={`${row.make} ${row.model}`} className="w-full h-full object-cover" placeholderClassName="flex h-full w-full items-center justify-center bg-black/20" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-foreground">{row.make} {row.model}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400 num">{row.listing_count.toLocaleString()} listed · avg {formatPrice(row.avg_price_lkr)}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-hover/trend:translate-x-0.5 group-hover/trend:text-amber-300" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-600">Awaiting data</p>
              )}
            </div>

            {/* Hot deals */}
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-400/70" /> Best deals
                </h3>
                <Link to="/best-picks" className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 no-underline transition-colors hover:text-amber-300">
                  All picks <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {hotDeals.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {hotDeals.slice(0, 4).map((row) => (
                    <Link key={row.id} to={`/listing/${row.id}`}
                      className="group/deal flex items-center gap-3 rounded-xl border border-white/[0.04] bg-[hsl(220,8%,5.5%)] p-3 no-underline transition-all hover:border-white/[0.08] hover:bg-[hsl(220,8%,6.5%)]"
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black/30">
                        <VehicleThumbnail src={row.thumbnail_url} listingId={row.id} alt={`${row.make} ${row.model}`} className="w-full h-full object-cover" placeholderClassName="flex h-full w-full items-center justify-center bg-black/20" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-foreground">{row.make} {row.model} {row.year}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400 num">{formatPrice(row.price_lkr)} · {row.district || "LK"}</p>
                      </div>
                      <span className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300 num">
                        +{Number(row.deal_score || 0).toFixed(0)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-600">No deals found in current slice</p>
              )}
            </div>
          </div>

          {/* Tool links */}
          <div className="mt-12 border-t border-white/[0.04] pt-8">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Intelligence tools</p>
            <div className="flex flex-wrap gap-2">
            {[
              { label: "Valuation", to: "/estimate" },
              { label: "Trends", to: "/trends" },
              { label: "Map", to: "/map" },
              { label: "Calculator", to: "/calculator" },
              { label: "EV Hub", to: "/ev-hub" },
            ].map((tool) => (
              <Link key={tool.label} to={tool.to}
                className="group/tool flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.015] px-4 py-2.5 text-[12px] font-semibold text-zinc-300 no-underline transition-all hover:border-amber-400/20 hover:bg-amber-400/[0.04] hover:text-zinc-100"
              >
                {tool.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500 transition-all group-hover/tool:text-amber-300 group-hover/tool:translate-x-0.5" />
              </Link>
            ))}
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ── COMPARE BAR ─────────────────────────────────────────── */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-[1200] w-[min(94vw,680px)] -translate-x-1/2">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[hsl(220,8%,6%)]/95 px-4 py-3 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Scale className="h-4 w-4 text-amber-400/60" />
              <span className="text-[12px] font-semibold text-foreground">{compareIds.length} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCompareListings([])}
                className="flex h-8 items-center gap-1 rounded-lg border border-white/[0.06] px-3 text-[10px] font-semibold text-zinc-400 transition-colors hover:text-zinc-200"
              ><X className="h-3 w-3" /> Clear</button>
              <button type="button" disabled={compareIds.length < 2} onClick={() => setShowCompare(true)}
                className="h-8 rounded-lg bg-[var(--gold)] px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-black transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-40"
              >Compare</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIALOGS ─────────────────────────────────────────────── */}
      <Dialog open={showMarketAlerts} onOpenChange={setShowMarketAlerts}>
        <DialogContent className="max-h-[86vh] max-w-2xl overflow-y-auto rounded-xl border-white/[0.06] bg-[hsl(220,8%,6%)] text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">Market alerts</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Current lane</p>
            <p className="mt-1.5 text-[13px] font-semibold text-foreground">{currentAlertSummary}</p>
            <div className="mt-3 flex gap-2">
              <Input value={alertPriceInput} onChange={(e) => setAlertPriceInput(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Target max price (LKR)" className="h-9 flex-1 rounded-lg border-white/[0.06] bg-transparent text-sm" />
              <button type="button" onClick={saveCurrentMarketAlert} className="h-9 rounded-lg bg-[var(--gold)] px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-black hover:bg-[var(--gold-bright)]">Save</button>
            </div>
          </div>
          {marketAlerts.length ? (
            <div className="space-y-1.5">
              {marketAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{alert.label}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{alert.target_price_lkr ? `Under ${formatPrice(alert.target_price_lkr)}` : "New listings"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { setFilters({ ...(alert.filters as FilterState), sort: alert.filters.sort || "newest", page: 1 }); setShowMarketAlerts(false); scrollToMarket(); }}
                      className="h-7 rounded-md border border-amber-400/15 bg-amber-400/5 px-2.5 text-[10px] font-semibold text-amber-300/80 hover:bg-amber-400/10">Open</button>
                    <button type="button" onClick={() => deleteMarketAlert(alert.id)}
                      className="h-7 rounded-md border border-white/[0.05] px-2.5 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="py-6 text-center text-[11px] text-zinc-600">No alerts saved</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={showSavedListings} onOpenChange={setShowSavedListings}>
        <DialogContent className="max-h-[86vh] max-w-2xl overflow-y-auto rounded-xl border-white/[0.06] bg-[hsl(220,8%,6%)] text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">Saved listings</DialogTitle>
          </DialogHeader>
          {savedListingsLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-lg" />)}</div>
          ) : savedListings.length ? (
            <div className="space-y-1.5">
              {savedListings.map((listing) => (
                <div key={listing.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-[hsl(220,8%,5%)] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{listing.make} {listing.model} {listing.year || ""}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{listing.district || "LK"} · {isReasonableListingPrice(Number(listing.price_lkr || 0)) ? formatPrice(listing.price_lkr) : "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => toggleWatchlist(listing)} className="h-7 rounded-md border border-amber-400/15 bg-amber-400/5 px-2.5 text-[10px] font-semibold text-amber-300/80 hover:bg-amber-400/10">Remove</button>
                    <Link to={`/listing/${listing.id}`} onClick={() => setShowSavedListings(false)} className="flex h-7 items-center gap-1 rounded-md border border-white/[0.05] px-2.5 text-[10px] font-semibold text-zinc-400 no-underline hover:text-zinc-200">
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="py-6 text-center text-[11px] text-zinc-600">No saved listings</p>}
          {savedListingsError && <p className="text-[11px] text-amber-300/60">{savedListingsError}</p>}
        </DialogContent>
      </Dialog>

      <ComparisonModal listings={comparedListings} open={showCompare} onClose={() => setShowCompare(false)} />
    </div>
  );
}
