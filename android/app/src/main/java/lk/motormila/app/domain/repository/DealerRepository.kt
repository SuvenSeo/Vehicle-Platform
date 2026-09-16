package lk.motormila.app.domain.repository

import lk.motormila.app.domain.model.DealerBenchmark
import lk.motormila.app.domain.model.DealerClaim

interface DealerRepository {
    suspend fun claim(
        dealerName: String,
        contactEmail: String,
        contactPhone: String?,
        sellerNamePattern: String? = null,
        claimedUrl: String? = null,
    ): DealerClaim
    suspend fun benchmark(dealerName: String): DealerBenchmark
    suspend fun myClaimStatus(): DealerClaim?
}
