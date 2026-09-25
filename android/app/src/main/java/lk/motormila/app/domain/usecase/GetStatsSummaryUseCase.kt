package lk.motormila.app.domain.usecase

import lk.motormila.app.domain.model.StatsSummary
import lk.motormila.app.domain.repository.StatsRepository
import javax.inject.Inject

class GetStatsSummaryUseCase @Inject constructor(
    private val stats: StatsRepository,
) {
    suspend operator fun invoke(): StatsSummary = stats.summary()
}
