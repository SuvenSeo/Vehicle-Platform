package lk.motormila.app.domain.repository

import lk.motormila.app.domain.model.ChargingStation
import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.DistrictVelocity
import lk.motormila.app.domain.model.EvStats
import lk.motormila.app.domain.model.FuelMixBucket
import lk.motormila.app.domain.model.MarketSignal
import lk.motormila.app.domain.model.PriceIndex
import lk.motormila.app.domain.model.TrendSeries
import lk.motormila.app.domain.model.VehicleNews

/** Insights-screen aggregate contract over stats/market/EV/calculator endpoints. */
interface InsightsRepository {
    suspend fun trends(
        make: String? = null,
        model: String? = null,
        condition: String? = null,
        district: String? = null,
        months: Int = 12,
    ): TrendSeries

    suspend fun index(): PriceIndex

    suspend fun districts(): List<DistrictStat>

    suspend fun velocities(): List<DistrictVelocity>

    suspend fun fuelMix(): List<FuelMixBucket>

    suspend fun signals(limit: Int = 30): List<MarketSignal>

    suspend fun chargers(
        lat: Double = 6.9271,
        lng: Double = 79.8612,
        radiusKm: Double = 25.0,
    ): List<ChargingStation>

    suspend fun news(limit: Int = 10): List<VehicleNews>

    suspend fun evStats(): EvStats
}
