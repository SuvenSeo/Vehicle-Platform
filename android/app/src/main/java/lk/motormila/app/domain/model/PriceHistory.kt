package lk.motormila.app.domain.model

/** Single tracked price observation. Mirrors `PriceHistoryPoint`. */
data class PricePoint(
    val priceLkr: Double,
    val scrapedAt: String,
)

/**
 * Price-history summary for one listing.
 * Mirrors backend `PriceHistoryResponse` (endpoints/listings.py).
 */
data class PriceHistory(
    val listingId: Int,
    val points: List<PricePoint> = emptyList(),
    val firstPriceLkr: Double? = null,
    val currentPriceLkr: Double? = null,
    val changePct: Double? = null,
    val cutCount: Int = 0,
    val raiseCount: Int = 0,
    val highestPriceLkr: Double? = null,
    val lowestPriceLkr: Double? = null,
    val lastChangeAt: String? = null,
    val trackedPoints: Int = 0,
) {
    val hasTrend: Boolean get() = points.size >= 2
    val isNetCut: Boolean get() = (changePct ?: 0.0) < 0
}
