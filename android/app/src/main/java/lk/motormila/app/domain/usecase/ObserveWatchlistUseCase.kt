package lk.motormila.app.domain.usecase

import kotlinx.coroutines.flow.Flow
import lk.motormila.app.domain.model.WatchItem
import lk.motormila.app.domain.repository.WatchlistRepository
import javax.inject.Inject

class ObserveWatchlistUseCase @Inject constructor(
    private val watchlist: WatchlistRepository,
) {
    operator fun invoke(): Flow<List<WatchItem>> = watchlist.observe()
}
