package lk.motormila.app.domain.model

/** Chat turn for the AI assistant (endpoints/chat.py). */
data class ChatMessage(
    val role: String,
    val content: String,
    val listings: List<Listing> = emptyList(),
)

/** Dealer benchmark payload (endpoints/dealer.py). */
data class DealerBenchmark(
    val dealerName: String,
    val listingCount: Int,
    val avgPriceLkr: Double?,
    val medianPriceLkr: Double?,
    val avgDealScore: Double?,
    val district: String?,
)

/** Result of a dealer claim request. */
data class DealerClaim(
    val claimId: String,
    val status: String,
    val message: String,
)
