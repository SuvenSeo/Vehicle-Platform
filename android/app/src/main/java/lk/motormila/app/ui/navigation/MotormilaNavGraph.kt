package lk.motormila.app.ui.navigation

import android.net.Uri
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navDeepLink
import androidx.navigation.toRoute
import kotlinx.coroutines.delay
import lk.motormila.app.R
import lk.motormila.app.core.network.AuthEvent
import lk.motormila.app.data.local.datastore.SessionStore
import lk.motormila.app.ui.MotormilaScaffold
import lk.motormila.app.ui.alerts.AlertsScreen
import lk.motormila.app.ui.auth.LoginScreen
import lk.motormila.app.ui.bestpicks.BestPicksScreen
import lk.motormila.app.ui.biometric.rememberBiometricAuth
import lk.motormila.app.ui.compare.CompareScreen
import lk.motormila.app.ui.dealer.DealerScreen
import lk.motormila.app.ui.detail.ListingDetailScreen
import lk.motormila.app.ui.ev.EvHubScreen
import lk.motormila.app.ui.home.HomeScreen
import lk.motormila.app.ui.insights.InsightsScreen
import lk.motormila.app.ui.notifications.NotificationsScreen
import lk.motormila.app.ui.pro.ProScreen
import lk.motormila.app.ui.profile.ProfileScreen
import lk.motormila.app.ui.pulse.OfficialPulseScreen
import lk.motormila.app.ui.scan.PlateScanScreen
import lk.motormila.app.ui.search.SearchScreen
import lk.motormila.app.ui.settings.SettingsScreen
import lk.motormila.app.ui.share.ShareImportScreen
import lk.motormila.app.ui.valuation.ValuationScreen
import lk.motormila.app.ui.watchlist.WatchlistScreen

/**
 * Root nav graph with persistent bottom navigation bar and auth event handling.
 * [sharedUrl] comes from MainActivity (ACTION_SEND).
 * [startDeepLink] is the ACTION_VIEW URI; splash runs first, then this target.
 * [navigationEventId] increments on each new intent so the same URI can be re-opened.
 */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun MotormilaNavGraph(
    sharedUrl: String? = null,
    startDeepLink: Uri? = null,
    navigationEventId: Int = 0,
    navController: NavHostController = rememberNavController(),
    viewModel: NavGraphViewModel = hiltViewModel(),
) {
    val uriHandler = LocalUriHandler.current
    val biometricLogin = rememberBiometricAuth(
        title = stringResource(R.string.biometric_title),
        subtitle = stringResource(R.string.biometric_login_subtitle),
    )
    val biometricSettings = rememberBiometricAuth(
        title = stringResource(R.string.biometric_title),
        subtitle = stringResource(R.string.biometric_settings_subtitle),
    )

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val isHome = currentDestination?.hasRoute<Home>() == true
    val isSearch = currentDestination?.hasRoute<Search>() == true
    val isWatchlist = currentDestination?.hasRoute<Watchlist>() == true
    val isInsights = currentDestination?.hasRoute<Insights>() == true
    val isProfile = currentDestination?.hasRoute<Profile>() == true
    val showBottomBar = isHome || isSearch || isWatchlist || isInsights || isProfile
    val selectedTab = when {
        isHome -> "home"
        isSearch -> "search"
        isWatchlist -> "watchlist"
        isInsights -> "insights"
        isProfile -> "profile"
        else -> ""
    }

    LaunchedEffect(Unit) {
        viewModel.authEventBus.events.collect { event ->
            if (event is AuthEvent.Unauthorized) {
                navController.navigate(Login) {
                    popUpTo(Home) { inclusive = true }
                    launchSingleTop = true
                }
            }
        }
    }

    LaunchedEffect(navigationEventId) {
        if (navigationEventId <= 1) return@LaunchedEffect
        val onSplash = navController.currentDestination?.hasRoute<Splash>() == true
        if (onSplash) return@LaunchedEffect
        if (sharedUrl != null) {
            navController.navigate(ShareImport(sharedUrl)) {
                launchSingleTop = true
            }
            return@LaunchedEffect
        }
        val target = startDeepLink?.let { resolveMotormilaDeepLink(it) } ?: return@LaunchedEffect
        navController.navigate(target) {
            launchSingleTop = true
        }
    }

    SharedTransitionLayout {
        MotormilaScaffold(
            selected = selectedTab,
            showBottomBar = showBottomBar,
            onNavigate = { routeKey ->
                val target: Any = when (routeKey) {
                    "home" -> Home
                    "search" -> Search()
                    "watchlist" -> Watchlist
                    "insights" -> Insights
                    "profile" -> Profile
                    else -> Home
                }
                navController.navigate(target) {
                    popUpTo(navController.graph.findStartDestination().id) {
                        saveState = true
                    }
                    launchSingleTop = true
                    restoreState = true
                }
            },
            onScan = { navController.navigate(PlateScan) },
            onOpenListing = { id -> navController.navigate(ListingDetail(id)) },
        ) { innerPadding ->
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                NavHost(
                    navController = navController,
                    startDestination = if (sharedUrl != null) ShareImport(sharedUrl) else Splash,
                ) {
                    composable<Splash> {
                        SplashGate(
                            sessionStore = viewModel.sessionStore,
                            onDone = { isLoggedIn ->
                                val deepLinkTarget = startDeepLink?.let { resolveMotormilaDeepLink(it) }
                                val target: Any = when {
                                    deepLinkTarget != null -> deepLinkTarget
                                    isLoggedIn -> Home
                                    else -> Login
                                }
                                navController.navigate(target) {
                                    popUpTo(Splash) { inclusive = true }
                                    launchSingleTop = true
                                }
                            },
                        )
                    }
                    composable<Login> {
                        LoginScreen(
                            onLoggedIn = {
                                navController.navigate(Home) {
                                    popUpTo(Login) { inclusive = true }
                                }
                            },
                            onBiometricAuth = biometricLogin,
                        )
                    }
                    composable<Home> {
                        HomeScreen(
                            onListingClick = { id -> navController.navigate(ListingDetail(id)) },
                            onSearchClick = { navController.navigate(Search()) },
                            onAlertsClick = { navController.navigate(Alerts) },
                            onSeeAll = { key ->
                                when (key) {
                                    "drops", "deals" -> navController.navigate(BestPicks)
                                    "districts" -> navController.navigate(Insights)
                                    else -> navController.navigate(Search())
                                }
                            },
                            onLoginClick = { navController.navigate(Login) },
                            onEvHubClick = { navController.navigate(EvHub) },
                            onBestPicksClick = { navController.navigate(BestPicks) },
                            onPulseClick = { navController.navigate(OfficialPulse) },
                        )
                    }
                    composable<Search>(
                        deepLinks = listOf(
                            navDeepLink<Search>(basePath = "motormila://search"),
                            navDeepLink { uriPattern = "motormila://search?q={q}&district={district}&voice={voice}" },
                            navDeepLink { uriPattern = "motormila://search" },
                        ),
                    ) {
                        SearchScreen(
                            onListingClick = { id -> navController.navigate(ListingDetail(id)) },
                            onCompare = { ids -> navController.navigate(Compare(ids)) },
                        )
                    }
                    composable<Watchlist>(
                        deepLinks = listOf(
                            navDeepLink { uriPattern = "motormila://watchlist" },
                        ),
                    ) {
                        WatchlistScreen(
                            onOpenDetail = { id -> navController.navigate(ListingDetail(id)) },
                            onCreateAlert = { navController.navigate(Alerts) },
                            onBrowse = { navController.navigate(Search()) },
                        )
                    }
                    composable<Insights> {
                        InsightsScreen(
                            onOpenPulseDetail = { navController.navigate(Notifications) },
                            onDrillDistrict = { district ->
                                navController.navigate(Search(district = district))
                            },
                            onSearchModels = { query ->
                                navController.navigate(Search(q = query))
                            },
                        )
                    }
                    composable<Profile> {
                        ProfileScreen(
                            onLoginClick = { navController.navigate(Login) },
                            onSettingsClick = { navController.navigate(Settings) },
                            onProClick = { navController.navigate(Pro) },
                            onDealerClick = { navController.navigate(Dealer) },
                            onAlertsClick = { navController.navigate(Alerts) },
                            onNotificationsClick = { navController.navigate(Notifications) },
                            onEvHubClick = { navController.navigate(EvHub) },
                            onPulseClick = { navController.navigate(OfficialPulse) },
                            onBestPicksClick = { navController.navigate(BestPicks) },
                        )
                    }
                    composable<ListingDetail>(
                        deepLinks = listOf(
                            navDeepLink { uriPattern = "motormila://listing/{id}" },
                            navDeepLink { uriPattern = "https://motormila.vercel.app/listing/{id}" },
                        ),
                    ) { entry ->
                        val route = entry.toRoute<ListingDetail>()
                        ListingDetailScreen(
                            listingId = route.id,
                            onBack = { navController.popBackStack() },
                            onCompare = { ids -> navController.navigate(Compare(ids)) },
                            onEstimate = { navController.navigate(Valuation()) },
                        )
                    }
                    composable<Compare> { entry ->
                        val route = entry.toRoute<Compare>()
                        CompareScreen(
                            ids = route.ids,
                            onOpenDetail = { id -> navController.navigate(ListingDetail(id)) },
                            onAddListing = { navController.navigate(Search()) },
                            onBrowse = { navController.navigate(Search()) },
                        )
                    }
                    composable<Valuation> {
                        ValuationScreen(
                            onOpenListing = { id -> navController.navigate(ListingDetail(id)) },
                        )
                    }
                    composable<Alerts> {
                        AlertsScreen(
                            onOpenDetail = { id -> navController.navigate(ListingDetail(id)) },
                            onUpgrade = { navController.navigate(Pro) },
                        )
                    }
                    composable<Notifications> {
                        NotificationsScreen(
                            onOpenNotification = { id ->
                                id.toIntOrNull()?.let { navController.navigate(ListingDetail(it)) }
                            },
                        )
                    }
                    composable<Pro> {
                        ProScreen(
                            onOpenCheckout = { url -> uriHandler.openUri(url) },
                            onOpenDistrict = { navController.navigate(Insights) },
                        )
                    }
                    composable<Dealer> {
                        DealerScreen(
                            onContactSupport = { uriHandler.openUri(SUPPORT_MAILTO) },
                        )
                    }
                    composable<Settings> {
                        SettingsScreen(
                            onLoggedOut = {
                                navController.navigate(Login) {
                                    popUpTo(Home) { inclusive = true }
                                }
                            },
                            onOpenUrl = { url -> uriHandler.openUri(url) },
                            onBiometricVerify = biometricSettings,
                        )
                    }
                    composable<PlateScan>(
                        deepLinks = listOf(navDeepLink { uriPattern = "motormila://scan" }),
                    ) {
                        PlateScanScreen(
                            onSearchPlate = { plate ->
                                navController.navigate(Search(q = plate, plate = plate))
                            },
                            onOpenFmv = { id -> navController.navigate(ListingDetail(id)) },
                        )
                    }
                    composable<ShareImport> { entry ->
                        val route = entry.toRoute<ShareImport>()
                        ShareImportScreen(
                            sharedUrl = route.url,
                            onSearch = { query ->
                                navController.navigate(
                                    Search(
                                        q = query.keyword,
                                        make = query.make,
                                        model = query.model,
                                        district = query.district,
                                        sort = query.sort,
                                    ),
                                ) {
                                    popUpTo(route) { inclusive = true }
                                }
                            },
                            onCompare = { ids ->
                                navController.navigate(Compare(ids)) {
                                    popUpTo(route) { inclusive = true }
                                }
                            },
                            onValuation = { make, model ->
                                navController.navigate(Valuation(make, model)) {
                                    popUpTo(route) { inclusive = true }
                                }
                            },
                            onBrowse = {
                                navController.navigate(Home) {
                                    popUpTo(route) { inclusive = true }
                                }
                            },
                        )
                    }
                    composable<EvHub>(
                        deepLinks = listOf(navDeepLink { uriPattern = "motormila://ev" }),
                    ) {
                        EvHubScreen(
                            onBack = { navController.popBackStack() },
                            onSearchModels = { query -> navController.navigate(Search(q = query)) },
                            onOpenListing = { id -> navController.navigate(ListingDetail(id)) },
                        )
                    }
                    composable<OfficialPulse>(
                        deepLinks = listOf(navDeepLink { uriPattern = "motormila://pulse" }),
                    ) {
                        OfficialPulseScreen(
                            onBack = { navController.popBackStack() },
                            onOpenUrl = { url -> uriHandler.openUri(url) },
                        )
                    }
                    composable<BestPicks>(
                        deepLinks = listOf(
                            navDeepLink { uriPattern = "motormila://home?dealOfDay=true" },
                            navDeepLink { uriPattern = "motormila://picks" },
                        ),
                    ) {
                        BestPicksScreen(
                            onBack = { navController.popBackStack() },
                            onListingClick = { id -> navController.navigate(ListingDetail(id)) },
                            onSeeAllSearch = {
                                navController.navigate(Search(sort = "deal_score"))
                            },
                        )
                    }
                }
            }
        }
    }
}

/**
 * Foundation-owned splash gate: verifies active session before navigating.
 * When a session exists, proceeds to [Home] (or a deep-link target); otherwise Login.
 */
@Composable
private fun SplashGate(
    sessionStore: SessionStore,
    onDone: (isLoggedIn: Boolean) -> Unit,
) {
    LaunchedEffect(Unit) {
        val session = sessionStore.snapshot()
        delay(400)
        onDone(session != null && !session.token.isNullOrBlank())
    }
    Box(Modifier.fillMaxSize())
}

private const val SUPPORT_MAILTO = "mailto:support@motormila.lk"
