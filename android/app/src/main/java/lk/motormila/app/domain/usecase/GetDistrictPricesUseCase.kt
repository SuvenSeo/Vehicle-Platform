package lk.motormila.app.domain.usecase

import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.repository.StatsRepository
import javax.inject.Inject

class GetDistrictPricesUseCase @Inject constructor(
    private val stats: StatsRepository,
) {
    suspend operator fun invoke(): List<DistrictStat> = stats.districtPrices()
}
