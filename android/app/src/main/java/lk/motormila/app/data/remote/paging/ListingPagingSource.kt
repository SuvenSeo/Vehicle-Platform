package lk.motormila.app.data.remote.paging

import androidx.paging.PagingSource
import androidx.paging.PagingState
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.repository.ListingQuery

/**
 * Network-only PagingSource for listing search.
 * Page keys are 1-based backend pages; [ListingQuery] mirrors GET /listings params.
 * Backend caps free plans to page 1 server-side; [nextKey] still follows `pages`.
 */
class ListingPagingSource(
    private val api: MotormilaApiService,
    private val query: ListingQuery,
    private val pageSize: Int = 20,
) : PagingSource<Int, Listing>() {

    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Listing> {
        val page = params.key ?: 1
        return try {
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
                // Always send the same page size — using params.loadSize on
                // page 1 (often 40-60) while pages 2+ send 20 makes the
                // backend page math overlap/skip items.
                size = pageSize,
            )
            LoadResult.Page(
                data = res.items.map { it.toDomain() },
                prevKey = if (page > 1) page - 1 else null,
                nextKey = if (page < res.pages && res.items.isNotEmpty()) page + 1 else null,
            )
        } catch (ce: kotlin.coroutines.cancellation.CancellationException) {
            throw ce
        } catch (t: Throwable) {
            LoadResult.Error(t)
        }
    }

    override fun getRefreshKey(state: PagingState<Int, Listing>): Int? =
        state.anchorPosition?.let { anchor ->
            state.closestPageToPosition(anchor)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchor)?.nextKey?.minus(1)
        }
}
