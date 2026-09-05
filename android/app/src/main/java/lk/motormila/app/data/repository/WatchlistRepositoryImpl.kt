package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import lk.motormila.app.data.local.db.MotormilaDatabase
import lk.motormila.app.data.local.db.entity.WatchlistEntity
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.model.WatchItem
import lk.motormila.app.domain.repository.WatchlistRepository

/** Local watchlist (Room). [refreshPrices] re-fetches each listing (best-effort). */
@Singleton
class WatchlistRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    private val db: MotormilaDatabase,
    @IoDispatcher private val io: CoroutineDispatcher,
) : WatchlistRepository {

    override fun observe(): Flow<List<WatchItem>> =
        db.watchlistDao().observeAll().map { rows -> rows.map { it.toDomain() } }

    override fun isWatched(listingId: Int): Flow<Boolean> =
        db.watchlistDao().isWatched(listingId)

    override suspend fun toggle(listing: Listing): Boolean = withContext(io) {
        val watched = db.watchlistDao().getAll().any { it.listingId == listing.id }
        if (watched) {
            db.watchlistDao().delete(listing.id)
            false
        } else {
            add(listing)
            true
        }
    }

    override suspend fun add(listing: Listing) = withContext(io) {
        db.watchlistDao().upsert(
            WatchlistEntity(
                listingId = listing.id,
                title = listing.displayName,
                thumbnailUrl = listing.heroImageUrl,
                priceAtAddLkr = listing.priceLkr,
                lastKnownPriceLkr = listing.priceLkr,
                addedAtMs = System.currentTimeMillis(),
                district = listing.district,
                fmvLkr = null,
                underFmv = null,
            ),
        )
    }

    override suspend fun remove(listingId: Int) = withContext(io) {
        db.watchlistDao().delete(listingId)
    }

    override suspend fun clear() = withContext(io) {
        db.watchlistDao().clear()
    }

    override suspend fun refreshPrices() = withContext(io) {
        db.watchlistDao().getAll().forEach { row ->
            val fresh = runCatching { api.getListing(row.listingId) }.getOrNull() ?: return@forEach
            val fmv = runCatching {
                api.getFmv(row.listingId)
                    .toDomain(askingFallbackLkr = fresh.priceLkr ?: row.lastKnownPriceLkr ?: 0.0)
                    .fmvLkr
            }.getOrNull()
            db.watchlistDao().upsert(
                row.copy(
                    lastKnownPriceLkr = fresh.priceLkr,
                    district = fresh.district ?: row.district,
                    fmvLkr = fmv ?: row.fmvLkr,
                    underFmv = underFmvFraction(fresh.priceLkr, fmv)
                        ?: underFmvFraction(fresh.priceLkr, row.fmvLkr)
                        ?: row.underFmv,
                ),
            )
        }
    }

    /** (fmv - price) / fmv when both present and fmv > 0, else null. */
    private fun underFmvFraction(price: Double?, fmv: Double?): Double? {
        if (price == null || fmv == null || fmv <= 0) return null
        return (fmv - price) / fmv
    }

    private fun WatchlistEntity.toDomain(): WatchItem {
        val price = lastKnownPriceLkr
        val fmv = fmvLkr
        return WatchItem(
            id = listingId,
            listingId = listingId,
            title = title,
            thumbnailUrl = thumbnailUrl,
            district = district,
            priceLkr = price,
            previousPriceLkr = priceAtAddLkr,
            fmvLkr = fmv,
            underFmvFraction = underFmv ?: underFmvFraction(price, fmv),
            addedAtEpochMs = addedAtMs,
        )
    }
}
