package lk.motormila.app.domain.model

/**
 * Market alert rule. Mirrors backend `MarketAlertRead` / `MarketAlertCreate`
 * (endpoints/alerts.py). user_token stays server-side; client keeps the id.
 */
data class Alert(
    val id: Int,
    val make: String?,
    val model: String?,
    val maxPriceLkr: Double?,
    val district: String?,
    val notifyPhone: String?,
    val notifyEmail: String?,
    val notifyTelegramChatId: String?,
    val notifyChannels: String?,
    val active: Boolean = true,
    val createdAt: String?,
) {
    val title: String
        get() = listOfNotNull(make, model).joinToString(" ").ifBlank { "Any vehicle" }
}

/** Input for creating/updating an alert (no id, no token). */
data class AlertInput(
    val make: String? = null,
    val model: String? = null,
    val maxPriceLkr: Double? = null,
    val district: String? = null,
    val notifyPhone: String? = null,
    val notifyEmail: String? = null,
    val notifyTelegramChatId: String? = null,
    val notifyChannels: String? = null,
)

/** One alert -> matching listings result. Mirrors `AlertMatchResult`. */
data class AlertMatch(
    val alertId: Int,
    val make: String?,
    val model: String?,
    val district: String?,
    val maxPriceLkr: Double?,
    val matchingCount: Int,
    val listings: List<AlertMatchListing> = emptyList(),
)

data class AlertMatchListing(
    val id: Int,
    val title: String?,
    val make: String,
    val model: String,
    val year: Int?,
    val priceLkr: Double?,
    val district: String?,
    val dealScore: Double?,
    val thumbnailUrl: String?,
)

/** Inbox notification row (GET /notifications). */
data class AppNotification(
    val id: Int,
    val title: String,
    val body: String,
    val kind: String,
    val listingId: Int?,
    val isRead: Boolean,
    val createdAt: String,
)
