package lk.motormila.app.data.remote.paging

import androidx.paging.ExperimentalPagingApi
import androidx.paging.LoadType
import androidx.paging.PagingState
import androidx.paging.RemoteMediator
import lk.motormila.app.data.local.db.MotormilaDatabase
import lk.motormila.app.data.local.db.entity.RemoteKeysEntity
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.data.remote.mapper.toEntity
import lk.motormila.app.data.local.db.entity.ListingEntity
import lk.motormila.app.domain.repository.ListingQuery

/**
 * Room-backed RemoteMediator: network-first with a 15-minute TTL per query.
 * - REFRESH: serve cache when fresh ([TTL_MS]); else reload page 1 and replace.
 * - PREPEND: never (backend pages are append-only, newest-first).
 * - APPEND: load next page from [RemoteKeysEntity], append to Room.
 * Query identity = stable hash of [ListingQuery] fields.
 */
@OptIn(ExperimentalPagingApi::class)
class ListingRemoteMediator(
    private val api: MotormilaApiService,
    private val db: MotormilaDatabase,
    private val query: ListingQuery,
    private val pageSize: Int = 20,
) : RemoteMediator<Int, ListingEntity>() {

    companion object {
        const val TTL_MS = 15 * 60 * 1000L
        fun hashOf(query: ListingQuery): String = query.toString().hashCode().toString(16)
    }

    private val hash: String = hashOf(query)

    override suspend fun load(
        loadType: LoadType,
        state: PagingState<Int, ListingEntity>,
    ): MediatorResult {
        return try {
            val keys = db.statsCacheDao().remoteKeys(hash)
            if (loadType == LoadType.REFRESH) {
                val fresh = keys != null &&
                    System.currentTimeMillis() - keys.updatedAtMs < TTL_MS
                if (fresh) return MediatorResult.Success(endOfPaginationReached = keys.nextPage == null)
            }
            if (loadType == LoadType.PREPEND) {
                return MediatorResult.Success(endOfPaginationReached = true)
            }
            val page = when (loadType) {
                LoadType.REFRESH -> 1
                LoadType.APPEND -> keys?.nextPage ?: 1
                LoadType.PREPEND -> return MediatorResult.Success(endOfPaginationReached = true)
            }
            val res = api.searchListings(
                q = query.keyword?.ifBlank { null },
                source = query.source,
                make = query.make,
                model = query.model,
                yearMin = query.yearMin,
                yearMax = query.yearMax,
                priceMin = query.priceMin,
                priceMax = query.priceMax,
                mileageMax = query.mileageMax,
                fuelType = query.fuelType,
                transmission = query.transmission,
                condition = query.condition,
                bodyType = query.bodyType,
                district = query.district,
                vehicleCategory = query.vehicleCategory,
                priceAvailability = null,
                sort = query.sort,
                page = page,
                size = pageSize,
            )
            val now = System.currentTimeMillis()
            if (loadType == LoadType.REFRESH) {
                db.listingDao().clear()
                db.statsCacheDao().clearRemoteKeys(hash)
            }
            db.listingDao().upsertAll(res.items.map { it.toDomain().toEntity(now) })
            val end = page >= res.pages || res.items.isEmpty()
            db.statsCacheDao().putRemoteKeys(
                RemoteKeysEntity(
                    queryHash = hash,
                    prevPage = if (page > 1) page - 1 else null,
                    nextPage = if (end) null else page + 1,
                    updatedAtMs = now,
                ),
            )
            MediatorResult.Success(endOfPaginationReached = end)
        } catch (t: Throwable) {
            MediatorResult.Error(t)
        }
    }
}
