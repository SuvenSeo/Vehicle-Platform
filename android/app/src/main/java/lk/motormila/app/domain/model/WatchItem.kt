package lk.motormila.app.domain.model

/**
 * Rich watchlist row consumed by WatchlistScreen + WatchlistViewModel.
 *
 * - [id] / [listingId] carry the same listing id ([listingId] kept for compat).
 * - [priceLkr] is the current/last-known price; [previousPriceLkr] the snapshot
 *   taken when the listing was added (drop baseline).
 * - [underFmvFraction] is the 0..1 fraction under FMV, null when unknown.
 */
data class WatchItem(
    val id: Int,
    val listingId: Int = id,
    val title: String,
    val thumbnailUrl: String?,
    val district: String?,
    val priceLkr: Double?,
    val previousPriceLkr: Double?,
    val fmvLkr: Double?,
    val underFmvFraction: Double?,
    val addedAtEpochMs: Long,
) {
    val hasPriceDrop: Boolean
        get() {
            val prev = previousPriceLkr
            val cur = priceLkr
            return prev != null && cur != null && cur < prev
        }

    /** Absolute drop (previous - current) when the price fell, else null. */
    fun dropAmount(): Double? {
        val prev = previousPriceLkr
        val cur = priceLkr
        return if (prev != null && cur != null && cur < prev) prev - cur else null
    }

    /** Signed percent change vs the add-price baseline, null when unknown. */
    fun dropPct(): Double? {
        val prev = previousPriceLkr
        val cur = priceLkr
        if (prev == null || cur == null || prev <= 0) return null
        return ((cur - prev) / prev) * 100.0
    }
}
