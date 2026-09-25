package lk.motormila.app.domain.model

/** Mirrors backend `HistoryReportFlag`. */
data class ReportFlag(
    val kind: String,
    /** "info" | "warn" | "critical". */
    val severity: String,
    val detail: String,
)

/** Mirrors backend `HistoryReportRelatedListing`. */
data class RelatedListing(
    val id: Int,
    val source: String,
    val title: String,
    val priceLkr: Double?,
    val mileageKm: Int?,
    val firstSeenAt: String?,
    val isActive: Boolean,
    val confidence: String,
)

/** Mirrors backend `HistoryReportResponse`. */
data class HistoryReport(
    val listingId: Int,
    val firstSeenAt: String?,
    val lastSeenAt: String?,
    val daysOnMarket: Int?,
    val isActive: Boolean,
    val pricePoints: List<PricePoint> = emptyList(),
    val priceCuts: Int = 0,
    val totalChangePct: Double? = null,
    val relatedListings: List<RelatedListing> = emptyList(),
    val flags: List<ReportFlag> = emptyList(),
    val disclaimer: String = "",
) {
    val criticalFlags: List<ReportFlag>
        get() = flags.filter { it.severity.equals("critical", ignoreCase = true) }
}
