package lk.motormila.app.domain.repository

import kotlinx.coroutines.flow.Flow
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.model.WatchItem

interface WatchlistRepository {
    /** Watched listings as a hot flow (Room-backed by data builder). */
    fun observe(): Flow<List<WatchItem>>

    /** Alias of [observe] expected by WatchlistViewModel. */
    fun observeWatchlist(): Flow<List<WatchItem>> = observe()

    fun isWatched(listingId: Int): Flow<Boolean>

    /** Toggle; returns true when now watched. Snapshot fields come from [listing]. */
    suspend fun toggle(listing: Listing): Boolean

    suspend fun add(listing: Listing)

    suspend fun remove(listingId: Int)

    /** Alias of [remove] expected by WatchlistViewModel. */
    suspend fun removeFromWatchlist(id: Int) = remove(id)

    suspend fun clear()

    /** Refresh stored last-known prices against network (best-effort). */
    suspend fun refreshPrices()
}
