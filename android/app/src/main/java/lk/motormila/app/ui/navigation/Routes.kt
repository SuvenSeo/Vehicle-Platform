package lk.motormila.app.ui.navigation

import android.net.Uri
import kotlinx.serialization.Serializable

/** Type-safe destinations. Bottom-bar tabs: Home, Search, Watchlist, Insights, Profile. */
@Serializable
data object Splash

@Serializable
data object Login

@Serializable
data object Home

@Serializable
data class Search(
    val q: String? = null,
    val district: String? = null,
    val make: String? = null,
    val model: String? = null,
    val sort: String? = null,
    val voice: Boolean = false,
    val plate: String? = null,
)

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
data class Valuation(val make: String? = null, val model: String? = null)

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

@Serializable
data object EvHub

@Serializable
data object OfficialPulse

@Serializable
data object BestPicks

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

private const val HTTPS_APP_HOST = "motormila.vercel.app"

/**
 * Maps a `motormila://` (or https listing) VIEW URI to a type-safe destination.
 * Used after splash and on [android.content.Intent.ACTION_VIEW] so optional query
 * params still land even when NavHost deep-link matching is picky.
 */
fun resolveMotormilaDeepLink(uri: Uri): Any? {
    val scheme = uri.scheme.orEmpty()
    val host = uri.host.orEmpty()
    if (scheme == "https" && host == HTTPS_APP_HOST) {
        val segments = uri.pathSegments
        if (segments.size >= 2 && segments[0] == "listing") {
            return segments[1].toIntOrNull()?.let { ListingDetail(it) }
        }
        return null
    }
    if (scheme != "motormila") return null
    return when (host) {
        "search" -> Search(
            q = uri.queryOrNull("q"),
            district = uri.queryOrNull("district"),
            make = uri.queryOrNull("make"),
            model = uri.queryOrNull("model"),
            sort = uri.queryOrNull("sort"),
            voice = uri.flagQuery("voice"),
            plate = uri.queryOrNull("plate"),
        )
        "watchlist" -> Watchlist
        "picks" -> BestPicks
        "home" -> if (uri.flagQuery("dealOfDay")) BestPicks else Home
        "ev" -> EvHub
        "pulse" -> OfficialPulse
        "scan" -> PlateScan
        "listing" -> uri.pathSegments.firstOrNull()?.toIntOrNull()?.let { ListingDetail(it) }
        "pro" -> if (uri.queryOrNull("deal") == "day") BestPicks else Pro
        else -> null
    }
}

private fun Uri.queryOrNull(key: String): String? =
    getQueryParameter(key)?.takeIf { it.isNotBlank() }

private fun Uri.flagQuery(key: String): Boolean {
    val value = getQueryParameter(key) ?: return false
    return value.equals("true", ignoreCase = true) ||
        value == "1" ||
        value.equals("yes", ignoreCase = true)
}
