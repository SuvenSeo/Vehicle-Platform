package lk.motormila.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Dealer DTOs. Backend: endpoints/dealer.py.
 * - POST /dealer/benchmark-urls {urls[]} -> [UrlBenchmarkResult]
 * - POST /dealer/claim {display_name,...} -> DealerClaimResponse
 * - GET /dealer/me?claim_token= -> DealerClaimResponse
 * - POST /dealer/verify -> DealerClaimResponse
 */
@Serializable
data class BenchmarkUrlsRequestDto(val urls: List<String> = emptyList())

@Serializable
data class UrlBenchmarkResultDto(
    val url: String = "",
    val make: String? = null,
    val model: String? = null,
    val year: Int? = null,
    @SerialName("listing_price") val listingPrice: Double? = null,
    @SerialName("market_median") val marketMedian: Double? = null,
    @SerialName("price_gap_pct") val priceGapPct: Double? = null,
    @SerialName("comparable_count") val comparableCount: Int = 0,
    val error: String? = null,
)

@Serializable
data class DealerClaimRequestDto(
    @SerialName("display_name") val displayName: String,
    @SerialName("contact_phone") val contactPhone: String? = null,
    @SerialName("contact_email") val contactEmail: String? = null,
    @SerialName("seller_name_pattern") val sellerNamePattern: String? = null,
    @SerialName("claimed_url") val claimedUrl: String? = null,
    @SerialName("claim_token") val claimToken: String? = null,
)

@Serializable
data class DealerClaimResponseDto(
    @SerialName("claim_id") val claimId: String? = null,
    val status: String = "pending",
    val message: String = "",
    @SerialName("claim_token") val claimToken: String? = null,
    @SerialName("display_name") val displayName: String? = null,
)

@Serializable
data class DealerVerifyRequestDto(
    @SerialName("claim_token") val claimToken: String,
    val code: String? = null,
)
