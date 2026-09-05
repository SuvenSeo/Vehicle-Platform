package lk.motormila.app.domain.model

/** Comparable used inside a valuation. Mirrors `ComparableVehicle`. */
data class Comparable(
    val id: Int,
    val title: String,
    val priceLkr: Double?,
    val district: String?,
    val dealScore: Double?,
    val detailUrl: String?,
    val externalUrl: String?,
)

/**
 * Custom vehicle estimate. Mirrors `CustomVehicleEstimateResponse`
 * (endpoints/listings.py estimate/custom-estimate).
 */
data class Valuation(
    val vehicleLabel: String,
    val lowLkr: Double,
    val medianLkr: Double,
    val highLkr: Double,
    val confidence: String,
    /** Backend verdict key, e.g. "great_deal" | "fair" | "overpriced". */
    val verdict: String,
    val verdictLabel: String,
    val deltaPct: Double?,
    val comparableCount: Int,
    val methodology: String,
    val comparables: List<Comparable> = emptyList(),
)

/** Input for estimate/custom-estimate. Mirrors `CustomVehicleEstimateRequest`. */
data class ValuationInput(
    val make: String,
    val model: String,
    val year: Int,
    val mileageKm: Int? = null,
    val condition: String? = null,
    val transmission: String? = null,
    val fuelType: String? = null,
    val bodyType: String? = null,
    val district: String? = null,
    val askingPriceLkr: Double? = null,
)
