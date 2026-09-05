package lk.motormila.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Pro DTOs. Backend: endpoints/pro.py + models/schemas.py
 * (ProMarketSnapshot, ProVehicleLane, ProDistrictProfile, ProDetailPayload,
 * ProArbitrageGap, ProBreakdownPoint, ProTrendPoint, ProMetric, ProListingSample).
 */
@Serializable
data class ProBreakdownPointDto(
    val label: String = "",
    val count: Int = 0,
    @SerialName("share_pct") val sharePct: Double = 0.0,
    @SerialName("avg_price_lkr") val avgPriceLkr: Double? = null,
    @SerialName("latest_seen_at") val latestSeenAt: String? = null,
)

@Serializable
data class ProTrendPointDto(
    val month: String = "",
    @SerialName("avg_price_lkr") val avgPriceLkr: Double? = null,
    @SerialName("median_price_lkr") val medianPriceLkr: Double? = null,
    @SerialName("listing_count") val listingCount: Int = 0,
)

@Serializable
data class ProMetricDto(
    val label: String = "",
    val value: String = "",
    val detail: String? = null,
)

@Serializable
data class ProListingSampleDto(
    val id: Int = 0,
    val title: String = "",
    val make: String = "",
    val model: String = "",
    val year: Int? = null,
    @SerialName("price_lkr") val priceLkr: Double? = null,
    val district: String? = null,
    val source: String = "",
    @SerialName("deal_score") val dealScore: Double? = null,
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    @SerialName("detail_url") val detailUrl: String? = null,
    @SerialName("external_url") val externalUrl: String? = null,
    @SerialName("first_seen_at") val firstSeenAt: String? = null,
    @SerialName("last_seen_at") val lastSeenAt: String? = null,
)

@Serializable
data class ProSnapshotDto(
    @SerialName("generated_at") val generatedAt: String = "",
    @SerialName("total_listings") val totalListings: Int = 0,
    @SerialName("avg_price_lkr") val avgPriceLkr: Double? = null,
    @SerialName("median_price_lkr") val medianPriceLkr: Double? = null,
    @SerialName("min_price_lkr") val minPriceLkr: Double? = null,
    @SerialName("max_price_lkr") val maxPriceLkr: Double? = null,
    @SerialName("new_listings_7d") val newListings7d: Int = 0,
    @SerialName("districts_covered") val districtsCovered: Int = 0,
    @SerialName("source_count") val sourceCount: Int = 0,
    @SerialName("hot_deal_count") val hotDealCount: Int = 0,
    @SerialName("last_updated") val lastUpdated: String? = null,
    @SerialName("source_coverage") val sourceCoverage: List<ProBreakdownPointDto> = emptyList(),
    @SerialName("top_opportunities") val topOpportunities: List<ProListingSampleDto> = emptyList(),
)

@Serializable
data class VehicleLaneDto(
    val make: String = "",
    val model: String = "",
    @SerialName("listing_count") val listingCount: Int = 0,
    @SerialName("avg_price_lkr") val avgPriceLkr: Double? = null,
    @SerialName("median_price_lkr") val medianPriceLkr: Double? = null,
    @SerialName("min_price_lkr") val minPriceLkr: Double? = null,
    @SerialName("max_price_lkr") val maxPriceLkr: Double? = null,
    @SerialName("avg_deal_score") val avgDealScore: Double? = null,
    @SerialName("district_count") val districtCount: Int = 0,
    @SerialName("source_count") val sourceCount: Int = 0,
    @SerialName("top_district") val topDistrict: String? = null,
    @SerialName("top_source") val topSource: String? = null,
    @SerialName("latest_seen_at") val latestSeenAt: String? = null,
)

@Serializable
data class DistrictProfileDto(
    val district: String = "",
    @SerialName("listing_count") val listingCount: Int = 0,
    @SerialName("avg_price_lkr") val avgPriceLkr: Double? = null,
    @SerialName("median_price_lkr") val medianPriceLkr: Double? = null,
    @SerialName("min_price_lkr") val minPriceLkr: Double? = null,
    @SerialName("max_price_lkr") val maxPriceLkr: Double? = null,
    @SerialName("source_count") val sourceCount: Int = 0,
    @SerialName("top_make") val topMake: String? = null,
    @SerialName("top_model") val topModel: String? = null,
    @SerialName("latest_seen_at") val latestSeenAt: String? = null,
    @SerialName("top_models") val topModels: List<DistrictTopModelDto> = emptyList(),
    @SerialName("source_mix") val sourceMix: List<ProBreakdownPointDto> = emptyList(),
    @SerialName("sample_listings") val sampleListings: List<ProListingSampleDto> = emptyList(),
)

@Serializable
data class LaneDetailDto(
    val kind: String = "",
    val title: String = "",
    val summary: String = "",
    @SerialName("generated_at") val generatedAt: String = "",
    val metrics: List<ProMetricDto> = emptyList(),
    @SerialName("source_mix") val sourceMix: List<ProBreakdownPointDto> = emptyList(),
    @SerialName("district_mix") val districtMix: List<ProBreakdownPointDto> = emptyList(),
    @SerialName("trend_points") val trendPoints: List<ProTrendPointDto> = emptyList(),
    @SerialName("sample_listings") val sampleListings: List<ProListingSampleDto> = emptyList(),
)

@Serializable
data class ArbitrageGapDto(
    @SerialName("buy_district") val buyDistrict: String = "",
    @SerialName("sell_district") val sellDistrict: String = "",
    @SerialName("buy_median_lkr") val buyMedianLkr: Double = 0.0,
    @SerialName("sell_median_lkr") val sellMedianLkr: Double = 0.0,
    @SerialName("gap_pct") val gapPct: Double = 0.0,
    @SerialName("buy_listing_count") val buyListingCount: Int = 0,
    @SerialName("sell_listing_count") val sellListingCount: Int = 0,
)
