package lk.motormila.app.domain.usecase

import androidx.paging.PagingData
import kotlinx.coroutines.flow.Flow
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.repository.ListingQuery
import lk.motormila.app.domain.repository.ListingRepository
import javax.inject.Inject

class GetListingsPagingUseCase @Inject constructor(
    private val listings: ListingRepository,
) {
    operator fun invoke(query: ListingQuery): Flow<PagingData<Listing>> = listings.paging(query)
}
