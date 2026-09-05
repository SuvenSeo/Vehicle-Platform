package lk.motormila.app.domain.model

/** Mirrors backend `SellerProfileResponse`. */
data class SellerProfile(
    val source: String,
    val sourceUrl: String,
    val sellerName: String?,
    /** "dealer" | "private" | "unknown". */
    val sellerType: String,
    val memberSince: String?,
    val listingCount: Int?,
    val reviewCount: Int?,
    val rating: Double?,
    val phoneNumbers: List<String> = emptyList(),
    val whatsappNumbers: List<String> = emptyList(),
    val verifiedBadges: List<String> = emptyList(),
    val fetchedAt: String?,
) {
    val isDealer: Boolean get() = sellerType.equals("dealer", ignoreCase = true)
    val primaryPhone: String? get() = phoneNumbers.firstOrNull()
    val primaryWhatsapp: String? get() = whatsappNumbers.firstOrNull() ?: primaryPhone
}
