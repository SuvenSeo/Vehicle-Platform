package lk.motormila.app.ui.home

/**
 * Bottom-tab badge helper (no-conflict fallback: if the foundation builder
 * ships its own badge source, delete this file and point
 * `MotormilaScaffold` at theirs — the [badgeFor] signature is the contract).
 */
data class HomeTabBadges(
    val watchlist: Int = 0,
    val alerts: Int = 0,
    val inbox: Int = 0,
)

/** Badge count for a nav badge key, or null when the tab shows no badge. */
fun badgeFor(key: String, badges: Map<String, Int>): Int? = when (key) {
    "watchlist" -> badges["watchlist"]
    "alerts" -> badges["alerts"]
    "inbox", "notifications", "profile" -> badges["inbox"] ?: badges["notifications"]
    else -> null
}

fun HomeTabBadges.toMap(): Map<String, Int> = mapOf(
    "watchlist" to watchlist,
    "alerts" to alerts,
    "inbox" to inbox,
)
