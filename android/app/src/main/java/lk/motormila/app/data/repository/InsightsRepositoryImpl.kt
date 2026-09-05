package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.ChargingStation
import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.DistrictVelocity
import lk.motormila.app.domain.model.EvStats
import lk.motormila.app.domain.model.FuelMixBucket
import lk.motormila.app.domain.model.MarketSignal
import lk.motormila.app.domain.model.PriceIndex
import lk.motormila.app.domain.model.TrendSeries
import lk.motormila.app.domain.model.VehicleNews
import lk.motormila.app.domain.repository.InsightsRepository

/**
 * Insights aggregates over stats/market/EV/calculator endpoints.
 * Errors propagate; the ViewModel isolates per-section failures.
 */
@Singleton
class InsightsRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    @IoDispatcher private val io: CoroutineDispatcher,
) : InsightsRepository {

    override suspend fun trends(
        make: String?,
        model: String?,
        condition: String?,
        district: String?,
        months: Int,
    ): TrendSeries = withContext(io) {
        api.trends(
            make = make?.ifBlank { null },
            model = model?.ifBlank { null },
            condition = condition?.ifBlank { null },
            district = district?.ifBlank { null },
            months = months,
        ).toDomain()
    }

    override suspend fun index(): PriceIndex = withContext(io) {
        api.priceIndex().toDomain()
    }

    override suspend fun districts(): List<DistrictStat> = withContext(io) {
        api.districtPrices().points.map { it.toDomain() }
    }

    override suspend fun velocities(): List<DistrictVelocity> = withContext(io) {
        api.districtVelocity().points.map { it.toDomain() }
    }

    override suspend fun fuelMix(): List<FuelMixBucket> = withContext(io) {
        val rows = api.fuelMix().buckets
        val total = rows.sumOf { it.count }.coerceAtLeast(1)
        rows.map { it.toDomain(total) }
    }

    override suspend fun signals(limit: Int): List<MarketSignal> = withContext(io) {
        api.marketSignals(limit = limit).map { it.toDomain() }
    }

    override suspend fun chargers(lat: Double, lng: Double, radiusKm: Double): List<ChargingStation> =
        withContext(io) {
            api.chargingStations(lat, lng, radiusKm).stations.map {
                ChargingStation(
                    name = it.name ?: it.title ?: "Charger",
                    address = it.address,
                    town = it.town,
                    distanceKm = it.distanceKm,
                    status = it.status,
                    connectors = it.connectionTypes,
                )
            }
        }

    override suspend fun news(limit: Int): List<VehicleNews> = withContext(io) {
        api.vehicleNews(limit).mapIndexed { index, item ->
            VehicleNews(
                id = "$index-${item.title.hashCode()}",
                title = item.title,
                source = item.source ?: "",
                timeLabel = item.publishedAt?.take(10) ?: "",
                url = item.url,
            )
        }
    }

    override suspend fun evStats(): EvStats = withContext(io) {
        val ev = api.evInsight()
        val mix = runCatching {
            val rows = api.fuelMix().buckets
            val total = rows.sumOf { it.count }.coerceAtLeast(1)
            rows.map { it.toDomain(total) }
        }.getOrDefault(emptyList())
        val electricShare = mix.firstOrNull { it.fuelType.contains("elect", ignoreCase = true) }?.pct ?: 0.0
        EvStats(
            count = ev.listingCount,
            sharePct = electricShare,
            medianLkr = ev.avgPriceLkr,
            aquaMedianLkr = null,
            savingsPerYearLkr = (300.0 / 12 - 6) * 50 * 365,
            topModels = ev.topModels.map { "${it.make} ${it.model}".trim() },
        )
    }
}
