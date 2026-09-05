package lk.motormila.app.domain.model

/** Pro lane row. Mirrors backend `ProVehicleLane` (endpoints/pro.py). */
data class VehicleLane(
    val make: String,
    val model: String,
    val listingCount: Int,
    val avgPriceLkr: Double?,
    val medianPriceLkr: Double?,
    val minPriceLkr: Double?,
    val maxPriceLkr: Double?,
    val avgDealScore: Double?,
    val districtCount: Int,
    val sourceCount: Int,
    val topDistrict: String?,
    val topSource: String?,
    val latestSeenAt: String?,
)

/** Pro market snapshot. Mirrors backend `ProMarketSnapshot`. */
data class ProSnapshot(
    val generatedAt: String,
    val totalListings: Int,
    val avgPriceLkr: Double?,
    val medianPriceLkr: Double?,
    val minPriceLkr: Double?,
    val maxPriceLkr: Double?,
    val newListings7d: Int,
    val districtsCovered: Int,
    val sourceCount: Int,
    val hotDealCount: Int,
    val lastUpdated: String?,
)

/** Pro district profile. Mirrors backend `ProDistrictProfile`. */
data class ProDistrict(
    val district: String,
    val listingCount: Int,
    val avgPriceLkr: Double?,
    val medianPriceLkr: Double?,
    val minPriceLkr: Double?,
    val maxPriceLkr: Double?,
    val sourceCount: Int,
    val topMake: String?,
    val topModel: String?,
    val latestSeenAt: String?,
)

/** Cross-district arbitrage gap. Mirrors backend `ProArbitrageGap`. */
data class ArbitrageGap(
    val buyDistrict: String,
    val sellDistrict: String,
    val buyMedianLkr: Double,
    val sellMedianLkr: Double,
    val gapPct: Double,
    val buyListingCount: Int,
    val sellListingCount: Int,
)
