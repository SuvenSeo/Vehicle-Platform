package lk.motormila.app.ui.navigation

import kotlinx.serialization.Serializable

/** Type-safe destinations. Bottom-bar tabs: Home, Search, Watchlist, Insights, Profile. */
@Serializable
data object Splash

@Serializable
data object Login

@Serializable
data object Home

@Serializable
data object Search

@Serializable
data object Watchlist

@Serializable
data object Insights

@Serializable
data object Profile

@Serializable
data class ListingDetail(val id: Int)

@Serializable
data class Compare(val ids: List<Int>)

@Serializable
data object Valuation

@Serializable
data object Alerts

@Serializable
data object Notifications

@Serializable
data object Pro

@Serializable
data object Dealer

@Serializable
data object Settings

@Serializable
data object PlateScan

@Serializable
data class ShareImport(val url: String? = null)

/** Routes that show the bottom NavigationBar. */
val BOTTOM_BAR_ROUTES: Set<String> = setOf(
    Home::class.qualifiedName!!,
    Search::class.qualifiedName!!,
    Watchlist::class.qualifiedName!!,
    Insights::class.qualifiedName!!,
    Profile::class.qualifiedName!!,
)

/** Returns true if the given destination route (qualified class name) shows the bottom bar. */
fun isBottomBarRoute(route: String?): Boolean = route in BOTTOM_BAR_ROUTES
