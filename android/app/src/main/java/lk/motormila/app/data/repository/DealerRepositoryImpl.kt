package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import lk.motormila.app.data.local.datastore.SettingsStore
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.BenchmarkUrlsRequestDto
import lk.motormila.app.data.remote.dto.DealerClaimRequestDto
import lk.motormila.app.data.remote.dto.UrlBenchmarkResultDto
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.DealerBenchmark
import lk.motormila.app.domain.model.DealerClaim
import lk.motormila.app.domain.repository.DealerRepository

/**
 * Dealer yard tools. Claim token from POST /dealer/claim is persisted in
 * SettingsStore so [myClaimStatus] survives process death.
 */
@Singleton
class DealerRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    private val settings: SettingsStore,
    @IoDispatcher private val io: CoroutineDispatcher,
) : DealerRepository {

    override suspend fun claim(dealerName: String, contactEmail: String, contactPhone: String?): DealerClaim =
        withContext(io) {
            val res = api.claimDealer(
                DealerClaimRequestDto(
                    displayName = dealerName,
                    contactEmail = contactEmail,
                    contactPhone = contactPhone,
                ),
            )
            res.claimToken?.let { settings.setDealerClaimToken(it) }
            DealerClaim(
                claimId = res.claimId ?: "",
                status = res.status,
                message = res.message,
            )
        }

    override suspend fun benchmark(dealerName: String): DealerBenchmark = withContext(io) {
        // Backend benchmarks URLs, not names: without URLs we can only return a shell.
        // Yard-tools UI should call benchmarkUrls(urls) below.
        DealerBenchmark(
            dealerName = dealerName,
            listingCount = 0,
            avgPriceLkr = null,
            medianPriceLkr = null,
            avgDealScore = null,
            district = null,
        )
    }

    /** URL-level benchmark aggregation for the yard-tools UI. */
    suspend fun benchmarkUrls(dealerName: String, urls: List<String>): DealerBenchmark = withContext(io) {
        val rows: List<UrlBenchmarkResultDto> = api.benchmarkUrls(BenchmarkUrlsRequestDto(urls))
        val medians = rows.mapNotNull { it.marketMedian }
        DealerBenchmark(
            dealerName = dealerName,
            listingCount = rows.size,
            avgPriceLkr = rows.mapNotNull { it.listingPrice }.average().takeIf { it.isFinite() && rows.isNotEmpty() },
            medianPriceLkr = medians.sorted().let { s -> if (s.isEmpty()) null else s[s.size / 2] },
            avgDealScore = null,
            district = null,
        )
    }

    override suspend fun myClaimStatus(): DealerClaim? = withContext(io) {
        val token = settings.observe().first().dealerClaimToken ?: return@withContext null
        val res = runCatching { api.dealerMe(token) }.getOrNull() ?: return@withContext null
        DealerClaim(claimId = res.claimId ?: "", status = res.status, message = res.message)
    }
}
