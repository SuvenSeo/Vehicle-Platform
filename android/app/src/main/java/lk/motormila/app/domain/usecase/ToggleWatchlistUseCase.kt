package lk.motormila.app.domain.usecase

import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.repository.WatchlistRepository
import javax.inject.Inject

class ToggleWatchlistUseCase @Inject constructor(
    private val watchlist: WatchlistRepository,
) {
    /** Returns true when the listing is now watched. */
    suspend operator fun invoke(listing: Listing): Boolean = watchlist.toggle(listing)
}
