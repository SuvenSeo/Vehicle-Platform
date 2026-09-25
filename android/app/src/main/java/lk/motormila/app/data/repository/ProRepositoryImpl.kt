package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.data.remote.mapper.toProDistrict
import lk.motormila.app.data.remote.mapper.toVehicleLane
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.ArbitrageGap
import lk.motormila.app.domain.model.ProDistrict
import lk.motormila.app.domain.model.ProSnapshot
import lk.motormila.app.domain.model.VehicleLane
import lk.motormila.app.domain.repository.ProRepository

/** Pro endpoints (gated server-side by plan; 403 → AppError.Forbidden). */
@Singleton
class ProRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    @IoDispatcher private val io: CoroutineDispatcher,
) : ProRepository {

    override suspend fun snapshot(): ProSnapshot = withContext(io) {
        api.proMarketSnapshot().toDomain()
    }

    override suspend fun lanes(limit: Int): List<VehicleLane> = withContext(io) {
        api.proVehicleLanes(limit = limit).map { it.toDomain() }
    }

    override suspend fun districts(limit: Int): List<ProDistrict> = withContext(io) {
        api.proDistricts(limit).map { it.toDomain() }
    }

    override suspend fun laneDetail(make: String, model: String): VehicleLane = withContext(io) {
        api.proVehicleLaneDetail(make, model).toVehicleLane()
    }

    override suspend fun districtDetail(district: String): ProDistrict = withContext(io) {
        api.proDistrictDetail(district).toProDistrict(district)
    }

    override suspend fun arbitrage(limit: Int): List<ArbitrageGap> = withContext(io) {
        // Backend requires a make scope; aggregate across top makes is out of scope —
        // callers pass make via arbitrageFor(make). Default keeps interface contract.
        arbitrageFor(make = "", limit = limit)
    }

    /** Make-scoped arbitrage (backend requires `make`). */
    suspend fun arbitrageFor(make: String, model: String? = null, limit: Int = 10): List<ArbitrageGap> =
        withContext(io) {
            if (make.isBlank()) return@withContext emptyList()
            api.proArbitrageGaps(make, model).take(limit).map { it.toDomain() }
        }
}
