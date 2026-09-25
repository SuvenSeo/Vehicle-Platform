package lk.motormila.app.domain.usecase

import lk.motormila.app.domain.model.Insights
import lk.motormila.app.domain.repository.StatsRepository
import javax.inject.Inject

class GetInsightsUseCase @Inject constructor(
    private val stats: StatsRepository,
) {
    suspend operator fun invoke(): Insights = stats.insights()
}
