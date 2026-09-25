package lk.motormila.app.domain.usecase

import lk.motormila.app.domain.model.PriceDrop
import lk.motormila.app.domain.repository.StatsRepository
import javax.inject.Inject

class GetPriceDropsUseCase @Inject constructor(
    private val stats: StatsRepository,
) {
    suspend operator fun invoke(days: Int = 7, limit: Int = 20): List<PriceDrop> =
        stats.priceDrops(days, limit)
}
