package lk.motormila.app.domain.repository

import kotlinx.coroutines.flow.Flow
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

interface StatsRepository {
    suspend fun summary(): StatsSummary
    fun summaryStream(): Flow<StatsSummary>

    suspend fun insights(): Insights

    suspend fun trends(
        make: String? = null,
        model: String? = null,
        condition: String? = null,
        district: String? = null,
        months: Int = 12,
    ): TrendSeries

    suspend fun priceIndex(): PriceIndex

    suspend fun districtPrices(): List<DistrictStat>

    suspend fun districtVelocity(): List<DistrictVelocity>

    suspend fun priceDrops(days: Int = 7, limit: Int = 20): List<PriceDrop>

    suspend fun fuelMix(): List<FuelMixBucket>

    suspend fun marketSignals(limit: Int = 20): List<MarketSignal>

    /** Lightweight "live" ticker for the home live-strip (poll/SSE abstracted by data). */
    fun liveListings(limit: Int = 10): Flow<List<Listing>>

    suspend fun evInsight(make: String? = null, model: String? = null): TrendSeries
}
