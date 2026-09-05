# DOMAIN_CONTRACT.md — Motormila Android (`lk.motormila.app`)

Owner: domain + core-UI builder. Other builders own `data/`, `di/`, `work/`,
gradle, manifest, theme, `Routes`/`NavGraph`.

## 0. Basis & deviations

- `android/NAV_CONTRACT.md` and `android/DATA_CONTRACT.md` **did not exist** when
  this was written (fresh `android/` tree). Defaults below apply.
- Backend shapes verified against `backend/app/models/schemas.py`,
  `backend/app/api/v1/endpoints/listings.py`, and `endpoints/stats.py`.
- Assumed provided by foundation builder: Hilt, `BuildConfig.BASE_URL`,
  theme (`Motion`/`Color`/`Type`), `Haptics`, `Routes`/`NavGraph`.
- Deviations from the brief:
  - `HistorySection`/`SellerCard` in `DetailScreen.kt` take resolved domain
    objects (`PriceHistory?`, `HistoryReport?`, `SellerProfile?`) instead of
    fetching internally — single source of truth stays in `DetailViewModel`.
  - Reduced motion is read via `LocalAccessibilityManager`
    (`rememberReducedMotion()` in `ui/components/ReducedMotion.kt`):
    touch-exploration ON ⇒ no stagger/shimmer/sweep/haptic. No platform
    animation-scale API is referenced; if the theme module adds one, wire it
    inside `rememberReducedMotion()` — callers need no change.
  - Share FMV card is currently a text share (`ACTION_SEND` + deep link
    `https://motormila.vercel.app/listings/{id}`). Bitmap renderer is a
    foundation-builder TODO (hook point: `shareListing()` in `DetailScreen.kt`).
  - Use cases live in one file per class under `domain/usecase/` (12 files).

## 1. Rules (binding on all builders)

- `domain/` is pure Kotlin: **zero `android.*` imports**, only
  `kotlinx.coroutines` / `Flow` (+ `androidx.paging:PagingData` for the paging
  stream type + `javax.inject.Inject` on use cases).
- UI talks to **domain use cases / repository interfaces only** — never
  Retrofit/Room directly. `data/` builder implements every interface in
  `domain/repository/`.
- All ViewModels are Hilt (`@HiltViewModel`), expose `StateFlow`, screens
  collect with `collectAsStateWithLifecycle`.
- 48dp touch targets, content descriptions, edge-to-edge `WindowInsets`
  respected via `Scaffold`/padding, skeletons + pull-refresh + error+retry +
  offline-cached badge on every screen.

## 2. Exact screen signatures (NavGraph MUST match)

```kotlin
// ui/home/HomeScreen.kt
@Composable
fun HomeScreen(
    onListingClick: (Int) -> Unit,
    onSearchClick: () -> Unit,
    onAlertsClick: () -> Unit,
    onSeeAll: (String) -> Unit,   // "drops" | "deals" | "districts" | "feed"
    viewModel: HomeViewModel = hiltViewModel(),
)

// ui/search/SearchScreen.kt
@Composable
fun SearchScreen(
    onListingClick: (Int) -> Unit,
    onCompare: (List<Int>) -> Unit,   // 2–3 ids, enforced max 3 in VM
    viewModel: SearchViewModel = hiltViewModel(),
)

// ui/detail/DetailScreen.kt
@Composable
fun ListingDetailScreen(
    listingId: Int,
    onBack: () -> Unit,
    onCompare: (List<Int>) -> Unit,
    onEstimate: () -> Unit,
    viewModel: DetailViewModel = hiltViewModel(),
)
```

- `DetailViewModel` reads `SavedStateHandle.get<Int>("listingId")`.
  **NavGraph/data builder: keep the argument key `"listingId"` (Int).**
- `SearchViewModel.paging: Flow<PagingData<Listing>>` — data builder provides
  `ListingRepository.paging()` (Paging3, `cachedIn` applied in VM).

## 3. ViewModels

| Class | State | Key functions |
|---|---|---|
| `ui.home.HomeViewModel` | `state: StateFlow<HomeUiState>`, `liveStrip: StateFlow<List<Listing>>` | `load()`, `refresh()`, `retry()`, `onToggleWatch(Listing)`, `feedQuery(): ListingQuery`, `dismissCachedBadge()` |
| `ui.search.SearchViewModel` | `state: StateFlow<SearchUiState>`, `paging: Flow<PagingData<Listing>>` | `onQueryChange`, `onSearch`, `applyFilters(ListingQuery)`, `onSortChange`, `openFilters/closeFilters/resetFilters`, `toggleCompare(Int)` (max 3), `clearCompare()`, `toggleWatch(Listing)`, `createAlertFromFilters()`, `consumeAlertSaved()`, `clearError()` |
| `ui.detail.DetailViewModel` | `state: StateFlow<DetailUiState>`, `listingId: Int` | `load()`, `retry()`, `toggleWatch()` |

## 4. Use cases (`domain/usecase/`, all `operator fun invoke`, `@Inject`)

| Class | Signature |
|---|---|
| `GetListingsPagingUseCase` | `(ListingQuery) -> Flow<PagingData<Listing>>` |
| `GetListingDetailUseCase` | `suspend (Int) -> Listing` |
| `GetSimilarUseCase` | `suspend (Int, limit: Int = 8) -> List<Listing>` |
| `ObserveWatchlistUseCase` | `() -> Flow<List<WatchItem>>` |
| `ToggleWatchlistUseCase` | `suspend (Listing) -> Boolean` (true = now watched) |
| `GetStatsSummaryUseCase` | `suspend () -> StatsSummary` |
| `GetInsightsUseCase` | `suspend () -> Insights` |
| `GetPriceDropsUseCase` | `suspend (days: Int = 7, limit: Int = 20) -> List<PriceDrop>` |
| `GetDistrictPricesUseCase` | `suspend () -> List<DistrictStat>` |
| `LoginUseCase` | `suspend (email: String, password: String) -> UserSession` |
| `LogoutUseCase` | `suspend () -> Unit` |
| `ObserveSessionUseCase` | `() -> Flow<UserSession?>` |

Repositories needing data implementations (no use-case wrapper yet — inject
directly): `ListingRepository` (detail/similar/history/fmv/seller/meta/
estimate), `StatsRepository` (+ `fuelMix`, `marketSignals`, `liveListings`,
`evInsight`), `AlertsRepository`, `WatchlistRepository`, `AuthRepository`,
`ValuationRepository` (`landedCost`, `tco`), `ProRepository`, `ChatRepository`,
`DealerRepository`. See `domain/repository/*.kt` for exact members.

## 5. Models (`domain/model/`)

`Listing` (+ `formattedPrice()`, `dealBand(): DealBand(GREAT/FAIR/HIGH/LOCKED)`,
`deltaVsMedianPct()`, `displayName`, `heroImageUrl`), `PriceHistory`/`PricePoint`,
`Fmv`, `SellerProfile`, `HistoryReport` (`ReportFlag`, `RelatedListing`),
`Stats` (`StatsSummary`, `DistrictStat`, `TrendPoint/TrendSeries`,
`PriceIndex(Point)`, `Insights`, `PriceDrop`, `DistrictVelocity`,
`FuelMixBucket`, `MarketSignal`), `Alert`/`AlertInput`/`AlertMatch`/
`AppNotification`, `WatchItem` (+ `dropPct()`), `UserSession` (`isPro`,
`isAdmin`), `Pro` (`VehicleLane`, `ProSnapshot`, `ProDistrict`,
`ArbitrageGap`), `Valuation`/`ValuationInput`/`Comparable`,
`Misc` (`ChatMessage`, `DealerBenchmark`, `DealerClaim`).

Free-tier rule (backend nulls `deal_score`/`market_median_lkr`): `dealScore ==
null ⇒ DealBand.LOCKED` ⇒ `DealBadge` LOCKED + `DealRing` outline + blurred
value. Gatekeep behind `UserSession.isPro`.

## 6. Shared components (`ui/components/`) + util

`ListingCard` (props: `listing, isWatched, onClick, onWatchToggle,
modifier, showDeal = true, sharedElementModifier = Modifier`),
`DealBadge(band, score, modifier, lockedLabel)`, `DealRing(score, band,
modifier, size = 36.dp)`, `FmvGauge(fmv, onExplainClick, modifier)`,
`PriceChart(points, fmvLkr, modifier)`, `States` (`shimmer()`,
`LoadingSkeletonCard/Row/Chart`, `EmptyState(title, body, ctaLabel, onCta)`,
`ErrorState(message, onRetry, cachedAvailable, onShowCached)`,
`OfflineBanner(visible)`, `LivePulse()`), `FilterSheet(current: ListingQuery,
makes, districts, resultCount, onApply, onReset, onDismiss)` + `FilterDraft`,
`SearchBar(query, onQueryChange, onSearch, suggestions, recentSearches,
onSuggestionClick, onRecentClick, onVoiceClick, modifier, showDropdown)`,
`rememberReducedMotion(): Boolean`. Util: `core/format/LkrFormat`
(`price/full/deltaPct/deltaLkr/km/count`).

## 7. For the data builder (endpoint map)

- Listings: `GET /listings` (sort `newest|deal_score|price_asc|price_desc|
  mileage_asc`; free tier caps page/size, forces `newest`), detail/similar/
  history/report/fmv/seller/estimate per `endpoints/listings.py`.
- Stats: `/stats/summary`, `/stats/insights`, `/stats/trends`, `/stats/
  price-index`, `/stats/district-prices`, `/stats/district-velocity`,
  `/listings/price-drops`, `/stats/fuel-mix`, `/stats/live` (+ `/live/stream`
  SSE optional — `liveListings()` may poll).
- Cache TTL 1h on summary/district/trends (server-side `market_stats_cache`);
  bust locally after writes where applicable.
