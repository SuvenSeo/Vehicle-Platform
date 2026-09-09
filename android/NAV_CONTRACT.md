# Motormila Android — NAV_CONTRACT (foundation ↔ screen builders)

`MotormilaNavGraph` (foundation-owned) calls every screen below. Section 1 lists
the **REAL signatures the screen builders landed** (graph verified against them).
All screens are landed — Section 2 is retired (kept as an empty placeholder so
old links don't break).

Destinations live in `ui.navigation.Routes.kt` (`@Serializable`, type-safe).
Keep ViewModels behind a `viewModel = hiltViewModel()` default so the graph
never names VM types.

## 1. Landed — graph matches these exactly

```kotlin
// lk.motormila.app.ui.home — HomeScreen.kt
@Composable
fun HomeScreen(
    onListingClick: (Int) -> Unit,   // -> ListingDetail(id)
    onSearchClick: () -> Unit,       // -> Search
    onAlertsClick: () -> Unit,       // -> Alerts
    onSeeAll: (String) -> Unit,      // -> Search (arg ignored, feed has no query route yet)
    onLoginClick: () -> Unit = {},   // -> Login (default keeps old call sites compiling)
    viewModel: HomeViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.search — SearchScreen.kt
@Composable
fun SearchScreen(
    onListingClick: (Int) -> Unit,   // -> ListingDetail(id)
    onCompare: (List<Int>) -> Unit,  // -> Compare(ids)
    viewModel: SearchViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.watchlist — WatchlistScreen.kt
@Composable
fun WatchlistScreen(
    onOpenDetail: (id: Int) -> Unit, // -> ListingDetail(id)
    onCreateAlert: (id: Int) -> Unit,// -> Alerts (arg ignored, no alertId route yet)
    onBrowse: () -> Unit,            // -> Search
    viewModel: WatchlistViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.insights — InsightsScreen.kt
@Composable
fun InsightsScreen(
    onOpenPulseDetail: (signalId: String) -> Unit, // -> Notifications
    onDrillDistrict: (district: String) -> Unit,  // -> Search
    onSearchModels: (query: String) -> Unit,      // -> Search
    viewModel: InsightsViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.detail — DetailScreen.kt
@Composable
fun ListingDetailScreen(
    listingId: Int,
    onBack: () -> Unit,                 // popBackStack
    onCompare: (List<Int>) -> Unit,     // -> Compare(ids)
    onEstimate: () -> Unit,             // -> Valuation
    viewModel: DetailViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.compare — CompareScreen.kt
@Composable
fun CompareScreen(
    ids: List<Int>,
    onOpenDetail: (id: Int) -> Unit, // -> ListingDetail(id)
    onAddListing: () -> Unit,        // -> Search
    onBrowse: () -> Unit,            // -> Search
    viewModel: CompareViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.valuation — ValuationScreen.kt
@Composable
fun ValuationScreen(
    onOpenListing: (id: Int) -> Unit, // -> ListingDetail(id)
    viewModel: ValuationViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.alerts — AlertsScreen.kt
@Composable
fun AlertsScreen(
    onOpenDetail: (id: Int) -> Unit, // -> ListingDetail(id)
    onUpgrade: () -> Unit,           // -> Pro
    viewModel: AlertsViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.notifications — NotificationsScreen.kt
@Composable
fun NotificationsScreen(
    // Graph parses Int ids -> ListingDetail(id); non-numeric ids are ignored.
    onOpenNotification: (id: String) -> Unit,
    viewModel: NotificationsViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.pro — ProScreen.kt
@Composable
fun ProScreen(
    onOpenCheckout: (url: String) -> Unit,   // opened via LocalUriHandler
    onOpenDistrict: (district: String) -> Unit, // -> Insights
    viewModel: ProViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.dealer — DealerScreen.kt
@Composable
fun DealerScreen(
    onContactSupport: () -> Unit, // opens mailto:support@motormila.lk
    viewModel: DealerViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.auth — LoginScreen.kt
@Composable
fun LoginScreen(
    onLoggedIn: () -> Unit, // -> Home (pops Login)
    // Foundation-provided: ui.biometric.rememberBiometricAuth()
    onBiometricAuth: (onSuccess: () -> Unit, onError: (String) -> Unit) -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.settings — SettingsScreen.kt
@Composable
fun SettingsScreen(
    onLoggedOut: () -> Unit, // -> Login (pops to Home inclusive)
    onOpenUrl: (url: String) -> Unit, // opened via LocalUriHandler
    // Foundation-provided: ui.biometric.rememberBiometricAuth()
    onBiometricVerify: (onSuccess: () -> Unit, onError: (String) -> Unit) -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.profile — ProfileScreen.kt (LANDED, was §2)
@Composable
fun ProfileScreen(
    onLoginClick: () -> Unit,        // -> Login
    onSettingsClick: () -> Unit,     // -> Settings
    onProClick: () -> Unit,          // -> Pro
    onDealerClick: () -> Unit,       // -> Dealer
    onAlertsClick: () -> Unit,       // -> Alerts
    onNotificationsClick: () -> Unit,// -> Notifications
    viewModel: ProfileViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.scan — PlateScanScreen.kt (LANDED, was §2 assumed
// onBack/onListingClick — REAL signature is onSearchPlate/onOpenFmv)
@Composable
fun PlateScanScreen(
    onSearchPlate: (plate: String) -> Unit, // -> Search (plate arg ignored, no query route yet)
    onOpenFmv: (listingId: Int) -> Unit,    // -> ListingDetail(id)
    viewModel: PlateScanViewModel = hiltViewModel(),
)
// ALSO LANDED: lk.motormila.app.ui.scan.ScanTileService : TileService
// (manifest-registered; fires motormila://scan).

// lk.motormila.app.ui.share — ShareImportScreen.kt (LANDED, was §2 assumed
// sharedUrl/onDone/onBack/viewModel — REAL signature forwards parsed targets)
@Composable
fun ShareImportScreen(
    sharedUrl: String?,
    onSearch: (ListingQuery) -> Unit,       // -> Search (query ignored, no query route yet)
    onCompare: (ids: List<Int>) -> Unit,    // -> Compare(ids)
    onValuation: (make: String, model: String) -> Unit, // -> Valuation
    onBrowse: () -> Unit,                   // -> Home
)
// NOTE: ShareImportScreen takes NO viewModel — parsing is synchronous via
// parseSharedUrl() + LaunchedEffect forward-once. Do not add one.
```

## 2. Missing — none (retired)

All 16 destinations are landed and the graph compiles against the real
signatures in §1. The old assumed signatures for `ProfileScreen`
(`§2` draft matched reality — now moved to §1), `PlateScanScreen`
(`onBack`/`onListingClick` — superseded by `onSearchPlate`/`onOpenFmv`),
and `ShareImportScreen` (`onDone`/`onBack`/`viewModel` — superseded by
`onSearch`/`onCompare`/`onValuation`/`onBrowse`, no ViewModel) are void.
New screens: add the destination to `Routes.kt`, wire it in
`MotormilaNavGraph.kt`, and record the exact signature in §1.

## Foundation-owned extras (not screens)

- `ui/biometric/BiometricAuth.kt` — `rememberBiometricAuth(title, subtitle)`
  framework-BiometricPrompt verifier (API 29+; graceful error below).
- `ShareImportActivity` (package root) — ACTION_SEND trampoline → MainActivity
  (`SHARED_URL_KEY` extra); `MainActivity.extractSharedUrl()` also handles a
  direct ACTION_SEND + first-URL fallback.
- `SplashGate` — private to `MotormilaNavGraph.kt`; checks
  `SessionStore.snapshot()` token non-blank → Home, else Login.
- `AuthEventBus.Unauthorized` collector — navigates to Login with
  `popUpTo(Home) { inclusive = true }`, `launchSingleTop = true`.
- Bottom bar shows ONLY on Home/Search/Watchlist/Insights/Profile
  (`hasRoute` checks in graph; `BOTTOM_BAR_ROUTES` in Routes.kt mirrors them).
- `MotormilaScaffold` bottom labels come from resources (`nav_home` …);
  nav icons + FABs carry content descriptions; FABs are 48dp/56dp.

## Deep links

- `motormila://listing/{id}` → ListingDetail (manifest + NavHost wired).
- `motormila://scan` → PlateScan (manifest + NavHost wired; QS tile fires it).
- Manifest does NOT declare `motormila://search`, `motormila://watchlist`,
  or `motormila://pro` — those shortcut intents target MainActivity
  explicitly (`targetClass`), so no intent-filter is needed for them.

## Shortcuts (`res/xml/shortcuts.xml`, referenced from MainActivity manifest)

| Id | Intent data | Status |
|---|---|---|
| `scan_plate` | `motormila://scan` | Wired end-to-end (manifest filter + NavHost). |
| `voice_search` | `motormila://search?voice=1` | Shortcut only — NavHost has no query/voice args yet; lands on MainActivity, graph starts at Splash→Home. |
| `deal_of_day` | `motormila://pro?deal=day` | Shortcut only — same as above (no NavHost args). |
| `watchlist` | `motormila://watchlist` | Shortcut only — same as above (no NavHost args). |

NOTE: shortcuts say `motormila://pro?deal=day`, not the older doc draft
`motormila://home?dealOfDay=true` — the xml is source of truth.
Wiring shortcut deep links into NavHost args (voice/dealOfDay) is a
future search-agent + foundation task; extras are ignored for v1.

## Rules for screen builders

- All static strings via resources; content descriptions on icon buttons/nav.
- 48dp minimum touch targets.
- No Android framework imports in data/domain layers (app/ui may use them).
- Dark-first tokens only from `ui.theme` (`MotormilaGold`, surfaces, …).
- Haptics via `rememberHaptics()`; motion via `emphasizedTween()`/`pressSpring()`.
- Do NOT rename landed-screen parameters — the graph calls them by name.
