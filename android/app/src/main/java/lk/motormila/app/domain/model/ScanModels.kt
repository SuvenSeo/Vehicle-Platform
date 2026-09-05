package lk.motormila.app.domain.model

/**
 * Plate lookup result consumed by PlateScanScreen + PlateScanViewModel.
 * [listingsFound] drives the "N matching listings" / "No live listings" copy;
 * [listingId] is null when nothing live matched (screen hides "Open FMV").
 */
data class PlateLookupResult(
    val plate: String,
    val listingId: Int?,
    val title: String,
    val priceLkr: Double?,
    val thumbnailUrl: String?,
    val fmvLkr: Double?,
    val matchNote: String,
    val listingsFound: Int = 0,
)
