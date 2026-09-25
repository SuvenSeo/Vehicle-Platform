package lk.motormila.app.data.remote.mapper

import lk.motormila.app.data.remote.dto.DealerClaimResponseDto
import lk.motormila.app.data.remote.dto.UrlBenchmarkResultDto
import lk.motormila.app.domain.model.DealerClaim
import lk.motormila.app.domain.model.UrlBenchmarkResult

fun DealerClaimResponseDto.toDomain(): DealerClaim = DealerClaim(
    claimId = claimId ?: id?.toString().orEmpty(),
    status = status,
    message = message,
    displayName = displayName,
    matchedListings = matchedListings,
    claimedUrl = claimedUrl,
    sellerNamePattern = sellerNamePattern,
)

fun UrlBenchmarkResultDto.toDomain(): UrlBenchmarkResult = UrlBenchmarkResult(
    url = url,
    listingPrice = listingPrice,
    marketMedian = marketMedian,
    priceGapPct = priceGapPct,
    error = error,
)
