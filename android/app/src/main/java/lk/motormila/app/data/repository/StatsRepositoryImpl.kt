package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import lk.motormila.app.data.local.db.MotormilaDatabase
import lk.motormila.app.data.local.db.entity.DistrictStatEntity
import lk.motormila.app.data.local.db.entity.StatsCacheEntity
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.data.remote.mapper.toTrendSeries
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.DistrictVelocity
import lk.motormila.app.domain.model.FuelMixBucket
import lk.motormila.app.domain.model.Insights
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.model.MarketSignal
import lk.motormila.app.domain.model.PriceDrop
import lk.motormila.app.domain.model.PriceIndex
import lk.motormila.app.domain.model.StatsSummary
import lk.motormila.app.domain.model.TrendSeries
import lk.motormila.app.domain.model.TrendingModel
import lk.motormila.app.domain.repository.StatsRepository

/**
 * Stats: network-first with a 15-min JSON cache (stats_cache) for summary;
 * district prices mirrored into district_stats for offline map rendering.
 */
@Singleton
class StatsRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    private val db: MotormilaDatabase,
    @IoDispatcher private val io: CoroutineDispatcher,
) : StatsRepository {

    companion object {
        const val TTL_MS = 15 * 60 * 1000L
        const val SUMMARY_KEY = "stats_summary"
    }

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun summary(): StatsSummary = withContext(io) {
        val fresh = api.statsSummary().toDomain()
        db.statsCacheDao().put(
            StatsCacheEntity(SUMMARY_KEY, json.encodeToString(fresh.toCache()), System.currentTimeMillis()),
        )
        fresh
    }

    override fun summaryStream(): Flow<StatsSummary> = flow {
        emit(cachedSummary() ?: StatsSummary())
        while (true) {
            delay(60_000)
            emit(runCatching { summary() }.getOrNull() ?: continue)
        }
    }

    override suspend fun insights(): Insights = withContext(io) {
        api.insights().toDomain()
    }

    override suspend fun trends(make: String?, model: String?, condition: String?, district: String?, months: Int): TrendSeries =
        withContext(io) {
            runCatching { api.trends(make, model, condition, district, months).toDomain() }
                .getOrElse {
                    // Fallback: model-level history when filtered trends are unavailable.
                    if (!make.isNullOrBlank() && !model.isNullOrBlank()) {
                        api.modelPriceHistory(make, model).toDomain().copy(coverageScope = "partial")
                    } else throw it
                }
        }

    override suspend fun priceIndex(): PriceIndex = withContext(io) {
        api.priceIndex().toDomain()
    }

    override suspend fun districtPrices(): List<DistrictStat> = withContext(io) {
        val now = System.currentTimeMillis()
        val dtos = api.districtPrices().points
        db.statsCacheDao().upsertDistricts(
            dtos.map {
                DistrictStatEntity(it.district, it.count, it.avgPriceLkr, it.medianPriceLkr, now)
            },
        )
        // Enrich with top-model insight per district (best-effort, cached).
        dtos.map { it.toDomain() }
    }

    fun observeCachedDistricts(): Flow<List<DistrictStat>> =
        db.statsCacheDao().observeDistricts().map { rows ->
            rows.map {
                DistrictStat(it.district, 0.0, 0.0, it.count, it.avgPriceLkr, it.medianPriceLkr)
            }
        }

    override suspend fun districtVelocity(): List<DistrictVelocity> = withContext(io) {
        api.districtVelocity().points.map { it.toDomain() }
    }

    override suspend fun priceDrops(days: Int, limit: Int): List<PriceDrop> = withContext(io) {
        api.getPriceDrops(days).items.take(limit).map { it.toDomain() }
    }

    override suspend fun fuelMix(): List<FuelMixBucket> = withContext(io) {
        val rows = api.fuelMix().buckets
        val total = rows.sumOf { it.count }.coerceAtLeast(1)
        rows.map { it.toDomain(total) }
    }

    override suspend fun marketSignals(limit: Int): List<MarketSignal> = withContext(io) {
        api.marketSignals(limit = limit).map { it.toDomain() }
    }

    override fun liveListings(limit: Int): Flow<List<Listing>> = flow {
        while (true) {
            val items = runCatching {
                api.searchListings(sort = "newest", page = 1, size = limit.coerceIn(1, 50))
                    .items.map { it.toDomain() }
            }.getOrNull().orEmpty()
            emit(items)
            delay(60_000)
        }
    }

    override suspend fun evInsight(make: String?, model: String?): TrendSeries = withContext(io) {
        api.evInsight(make, model).toTrendSeries()
    }

    /** EV model leaderboard helper (no domain interface; UI reads impl directly). */
    suspend fun evModels(topN: Int = 5): List<TrendingModel> = withContext(io) {
        api.evInsight(topN = topN).topModels.map { it.toDomain() }
    }

    private suspend fun cachedSummary(): StatsSummary? {
        val row = db.statsCacheDao().get(SUMMARY_KEY) ?: return null
        if (System.currentTimeMillis() - row.updatedAtMs > TTL_MS) return null
        return runCatching { json.decodeFromString<StatsSummaryCache>(row.json).toDomain() }.getOrNull()
    }

    @kotlinx.serialization.Serializable
    private data class StatsSummaryCache(
        val totalListings: Int = 0,
        val avgPriceLkr: Double? = null,
        val priceChangeMom: Double? = null,
        val goodDealsCount: Int = 0,
        val listingsThisWeek: Int = 0,
        val districtsCovered: Int = 0,
        val sourceCount: Int = 0,
        val lastUpdated: String? = null,
    ) {
        fun toDomain() = StatsSummary(totalListings, avgPriceLkr, priceChangeMom, goodDealsCount, listingsThisWeek, districtsCovered, sourceCount, lastUpdated)
    }

    private fun StatsSummary.toCache() = StatsSummaryCache(totalListings, avgPriceLkr, priceChangeMom, goodDealsCount, listingsThisWeek, districtsCovered, sourceCount, lastUpdated)
}
