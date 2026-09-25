package lk.motormila.app.ui.pro

import lk.motormila.app.domain.model.ArbitrageGap
import lk.motormila.app.domain.model.ProDistrict
import lk.motormila.app.domain.model.ProSnapshot
import lk.motormila.app.domain.model.VehicleLane

/**
 * Builds CSV text for Android share/export. Mirrors the web Pro CSV lane
 * (client-side jspdf/csv) without pulling a PDF library into the APK.
 */
object ProCsvExport {
    fun build(
        snapshot: ProSnapshot?,
        lanes: List<VehicleLane>,
        districts: List<ProDistrict>,
        arbitrage: List<ArbitrageGap>,
    ): String {
        val sections = mutableListOf<String>()
        sections += snapshotSection(snapshot)
        sections += ""
        sections += lanesSection(lanes)
        sections += ""
        sections += districtsSection(districts)
        sections += ""
        sections += arbitrageSection(arbitrage)
        return sections.joinToString("\n")
    }

    private fun snapshotSection(snapshot: ProSnapshot?): String {
        val header = "section,metric,value"
        if (snapshot == null) return listOf(header, "snapshot,status,unavailable").joinToString("\n")
        val rows = listOf(
            csv("snapshot", "generated_at", snapshot.generatedAt),
            csv("snapshot", "total_listings", snapshot.totalListings.toString()),
            csv("snapshot", "avg_price_lkr", snapshot.avgPriceLkr?.toString().orEmpty()),
            csv("snapshot", "median_price_lkr", snapshot.medianPriceLkr?.toString().orEmpty()),
            csv("snapshot", "new_listings_7d", snapshot.newListings7d.toString()),
            csv("snapshot", "hot_deal_count", snapshot.hotDealCount.toString()),
            csv("snapshot", "districts_covered", snapshot.districtsCovered.toString()),
            csv("snapshot", "source_count", snapshot.sourceCount.toString()),
            csv("snapshot", "last_updated", snapshot.lastUpdated.orEmpty()),
        )
        return (listOf(header) + rows).joinToString("\n")
    }

    private fun lanesSection(lanes: List<VehicleLane>): String {
        val header = "section,make,model,listing_count,avg_price_lkr,median_price_lkr,avg_deal_score,top_district,top_source"
        val rows = lanes.map { lane ->
            listOf(
                "lane",
                lane.make,
                lane.model,
                lane.listingCount.toString(),
                lane.avgPriceLkr?.toString().orEmpty(),
                lane.medianPriceLkr?.toString().orEmpty(),
                lane.avgDealScore?.toString().orEmpty(),
                lane.topDistrict.orEmpty(),
                lane.topSource.orEmpty(),
            ).joinToString(",") { escape(it) }
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    private fun districtsSection(districts: List<ProDistrict>): String {
        val header = "section,district,listing_count,avg_price_lkr,median_price_lkr,top_make,top_model"
        val rows = districts.map { d ->
            listOf(
                "district",
                d.district,
                d.listingCount.toString(),
                d.avgPriceLkr?.toString().orEmpty(),
                d.medianPriceLkr?.toString().orEmpty(),
                d.topMake.orEmpty(),
                d.topModel.orEmpty(),
            ).joinToString(",") { escape(it) }
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    private fun arbitrageSection(arbitrage: List<ArbitrageGap>): String {
        val header = "section,buy_district,sell_district,buy_median_lkr,sell_median_lkr,gap_pct,buy_listing_count,sell_listing_count"
        val rows = arbitrage.map { gap ->
            listOf(
                "arbitrage",
                gap.buyDistrict,
                gap.sellDistrict,
                gap.buyMedianLkr.toString(),
                gap.sellMedianLkr.toString(),
                gap.gapPct.toString(),
                gap.buyListingCount.toString(),
                gap.sellListingCount.toString(),
            ).joinToString(",") { escape(it) }
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    private fun csv(section: String, metric: String, value: String): String =
        listOf(section, metric, value).joinToString(",") { escape(it) }

    private fun escape(raw: String): String {
        if (raw.isEmpty()) return ""
        return if (raw.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) {
            "\"${raw.replace("\"", "\"\"")}\""
        } else {
            raw
        }
    }
}
