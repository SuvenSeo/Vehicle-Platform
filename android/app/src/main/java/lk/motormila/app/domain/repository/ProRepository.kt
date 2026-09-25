package lk.motormila.app.domain.repository

import lk.motormila.app.domain.model.ArbitrageGap
import lk.motormila.app.domain.model.ProDistrict
import lk.motormila.app.domain.model.ProSnapshot
import lk.motormila.app.domain.model.VehicleLane

interface ProRepository {
    suspend fun snapshot(): ProSnapshot
    suspend fun lanes(limit: Int = 20): List<VehicleLane>
    suspend fun districts(limit: Int = 25): List<ProDistrict>
    suspend fun laneDetail(make: String, model: String): VehicleLane
    suspend fun districtDetail(district: String): ProDistrict
    suspend fun arbitrage(limit: Int = 10): List<ArbitrageGap>
}
