package lk.motormila.app.domain.model

/**
 * Fair-market-value verdict for a listing.
 * Derived from backend FMV util (app/utils/fmv.py) + estimate endpoints.
 */
data class Fmv(
    val askingLkr: Double,
    val fmvLkr: Double?,
    val dealScore: Double?,
    val deltaPct: Double?,
    val band: DealBand,
    /** Short machine key, e.g. "great_deal" / "fair" / "overpriced" / "locked". */
    val label: String,
    val method: String?,
    val sampleCount: Int,
    /** Backend confidence token: "high" | "medium" | "low". */
    val confidence: String,
) {
    val hasSignal: Boolean get() = fmvLkr != null && band != DealBand.LOCKED
}
