package lk.motormila.app.ui.navigation

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
import lk.motormila.app.ui.biometric.rememberBiometricAuth

import lk.motormila.app.ui.alerts.AlertsScreen
import lk.motormila.app.ui.auth.LoginScreen
import lk.motormila.app.ui.compare.CompareScreen
import lk.motormila.app.ui.dealer.DealerScreen
import lk.motormila.app.ui.detail.ListingDetailScreen
import lk.motormila.app.ui.home.HomeScreen
import lk.motormila.app.ui.insights.InsightsScreen
import lk.motormila.app.ui.notifications.NotificationsScreen
import lk.motormila.app.ui.pro.ProScreen
import lk.motormila.app.ui.profile.ProfileScreen
import lk.motormila.app.ui.scan.PlateScanScreen
import lk.motormila.app.ui.search.SearchScreen
import lk.motormila.app.ui.settings.SettingsScreen
import lk.motormila.app.ui.share.ShareImportScreen
import lk.motormila.app.ui.valuation.ValuationScreen
import lk.motormila.app.ui.watchlist.WatchlistScreen

/**
 * Root nav graph with persistent bottom navigation bar and auth event handling.
 * [sharedUrl] comes from MainActivity (ACTION_SEND / deep link).
 */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun MotormilaNavGraph(
    sharedUrl: String? = null,
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

    SharedTransitionLayout {
        MotormilaScaffold(
            selected = selectedTab,
            showBottomBar = showBottomBar,
            onNavigate = { routeKey ->
                val target: Any = when (routeKey) {
                    "home" -> Home
                    "search" -> Search
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
                                val target: Any = if (isLoggedIn) Home else Login
                                navController.navigate(target) {
                                    popUpTo(Splash) { inclusive = true }
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
                            onSearchClick = { navController.navigate(Search) },
                            onAlertsClick = { navController.navigate(Alerts) },
                            onSeeAll = { navController.navigate(Search) },
                            onLoginClick = { navController.navigate(Login) },
                        )
                    }
                    composable<Search> {
                        SearchScreen(
                            onListingClick = { id -> navController.navigate(ListingDetail(id)) },
                            onCompare = { ids -> navController.navigate(Compare(ids)) },
                        )
                    }
                    composable<Watchlist> {
                        WatchlistScreen(
                            onOpenDetail = { id -> navController.navigate(ListingDetail(id)) },
                            onCreateAlert = { navController.navigate(Alerts) },
                            onBrowse = { navController.navigate(Search) },
                        )
                    }
                    composable<Insights> {
                        InsightsScreen(
                            onOpenPulseDetail = { navController.navigate(Notifications) },
                            onDrillDistrict = { navController.navigate(Search) },
                            onSearchModels = { navController.navigate(Search) },
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
                        )
                    }
                    composable<ListingDetail>(
                        deepLinks = listOf(navDeepLink { uriPattern = "motormila://listing/{id}" }),
                    ) { entry ->
                        val route = entry.toRoute<ListingDetail>()
                        ListingDetailScreen(
                            listingId = route.id,
                            onBack = { navController.popBackStack() },
                            onCompare = { ids -> navController.navigate(Compare(ids)) },
                            onEstimate = { navController.navigate(Valuation) },
                        )
                    }
                    composable<Compare> { entry ->
                        val route = entry.toRoute<Compare>()
                        CompareScreen(
                            ids = route.ids,
                            onOpenDetail = { id -> navController.navigate(ListingDetail(id)) },
                            onAddListing = { navController.navigate(Search) },
                            onBrowse = { navController.navigate(Search) },
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
                            onSearchPlate = { navController.navigate(Search) },
                            onOpenFmv = { id -> navController.navigate(ListingDetail(id)) },
                        )
                    }
                    composable<ShareImport> { entry ->
                        val route = entry.toRoute<ShareImport>()
                        ShareImportScreen(
                            sharedUrl = route.url,
                            onSearch = { _ ->
                                navController.navigate(Search) {
                                    popUpTo(route) { inclusive = true }
                                }
                            },
                            onCompare = { ids ->
                                navController.navigate(Compare(ids)) {
                                    popUpTo(route) { inclusive = true }
                                }
                            },
                            onValuation = { _, _ ->
                                navController.navigate(Valuation) {
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
                }
            }
        }
    }
}

/**
 * Foundation-owned splash gate: verifies active session before navigating.
 * When a session exists, proceeds to [Home]; otherwise routes to [Login].
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
