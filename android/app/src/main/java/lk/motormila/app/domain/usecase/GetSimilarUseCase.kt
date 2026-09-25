package lk.motormila.app.domain.usecase

import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.repository.ListingRepository
import javax.inject.Inject

class GetSimilarUseCase @Inject constructor(
    private val listings: ListingRepository,
) {
    suspend operator fun invoke(id: Int, limit: Int = 8): List<Listing> = listings.similar(id, limit)
}
