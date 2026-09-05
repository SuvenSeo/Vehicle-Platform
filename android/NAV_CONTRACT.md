# Motormila Android — NAV_CONTRACT (foundation ↔ screen builders)

`MotormilaNavGraph` (foundation-owned) calls every screen below. Section 1 lists
the **REAL signatures the screen builders landed** (graph verified against them).
Section 2 lists the **still-missing screens** with the assumed signatures the
graph compiles against — implement exactly these.

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
```

## 2. Missing — implement exactly these (graph already imports them)

```kotlin
// lk.motormila.app.ui.profile
@Composable
fun ProfileScreen(
    onLoginClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onProClick: () -> Unit,
    onDealerClick: () -> Unit,
    onAlertsClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel(),
)

// lk.motormila.app.ui.scan
@Composable
fun PlateScanScreen(
    onBack: () -> Unit,
    onListingClick: (Int) -> Unit,
    viewModel: PlateScanViewModel = hiltViewModel(),
)
// ALSO: lk.motormila.app.ui.scan.ScanTileService : TileService
// (manifest-registered; opens motormila://scan).

// lk.motormila.app.ui.shareimport
@Composable
fun ShareImportScreen(
    sharedUrl: String?,
    onDone: () -> Unit,
    onBack: () -> Unit,
    viewModel: ShareImportViewModel = hiltViewModel(),
)
```

## Foundation-owned extras (not screens)

- `ui/biometric/BiometricAuth.kt` — `rememberBiometricAuth(title, subtitle)`
  framework-BiometricPrompt verifier (API 29+; graceful error below).
- `ShareImportActivity` (package root) — ACTION_SEND trampoline → MainActivity.
- `SplashGate` — private to `MotormilaNavGraph.kt`; v1 routes to Home.

## Deep links

- `motormila://listing/{id}` → ListingDetail (manifest + NavHost wired).
- `motormila://scan` → PlateScan (manifest + NavHost wired).
- `motormila://search?voice=true`, `motormila://home?dealOfDay=true`,
  `motormila://watchlist` → manifest shortcuts only; in-NavHost args not yet
  wired (voice/dealOfDay extras ignored for v1).

## Rules for screen builders

- All static strings via resources; content descriptions on icon buttons/nav.
- 48dp minimum touch targets.
- No Android framework imports in data/domain layers (app/ui may use them).
- Dark-first tokens only from `ui.theme` (`MotormilaGold`, surfaces, …).
- Haptics via `rememberHaptics()`; motion via `emphasizedTween()`/`pressSpring()`.
- Do NOT rename landed-screen parameters — the graph calls them by name.
