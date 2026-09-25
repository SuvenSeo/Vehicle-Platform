package lk.motormila.app.ui.pro

import lk.motormila.app.domain.model.ArbitrageGap
import lk.motormila.app.domain.model.ProDistrict
import lk.motormila.app.domain.model.ProSnapshot
import lk.motormila.app.domain.model.VehicleLane
import org.junit.Assert.assertTrue
import org.junit.Test

class ProCsvExportTest {
    @Test
    fun build_includesSnapshotLanesDistrictsAndArbitrage() {
        val csv = ProCsvExport.build(
            snapshot = ProSnapshot(
                generatedAt = "2026-09-16T00:00:00Z",
                totalListings = 240_000,
                avgPriceLkr = 8_000_000.0,
                medianPriceLkr = 7_500_000.0,
                minPriceLkr = null,
                maxPriceLkr = null,
                newListings7d = 1200,
                districtsCovered = 25,
                sourceCount = 4,
                hotDealCount = 80,
                lastUpdated = "2026-09-16",
            ),
            lanes = listOf(
                VehicleLane(
                    make = "Toyota",
                    model = "Axio",
                    listingCount = 200,
                    avgPriceLkr = 8_400_000.0,
                    medianPriceLkr = 8_200_000.0,
                    minPriceLkr = null,
                    maxPriceLkr = null,
                    avgDealScore = 7.0,
                    districtCount = 3,
                    sourceCount = 2,
                    topDistrict = "Colombo",
                    topSource = "ikman",
                    latestSeenAt = null,
                ),
            ),
            districts = listOf(
                ProDistrict(
                    district = "Colombo",
                    listingCount = 1000,
                    avgPriceLkr = 9_000_000.0,
                    medianPriceLkr = 8_500_000.0,
                    minPriceLkr = null,
                    maxPriceLkr = null,
                    sourceCount = 3,
                    topMake = "Toyota",
                    topModel = "Axio",
                    latestSeenAt = null,
                ),
            ),
            arbitrage = listOf(
                ArbitrageGap(
                    buyDistrict = "Kurunegala",
                    sellDistrict = "Colombo",
                    buyMedianLkr = 7_800_000.0,
                    sellMedianLkr = 8_250_000.0,
                    gapPct = 5.8,
                    buyListingCount = 40,
                    sellListingCount = 200,
                ),
            ),
        )
        assertTrue(csv.contains("total_listings"))
        assertTrue(csv.contains("Toyota"))
        assertTrue(csv.contains("Colombo"))
        assertTrue(csv.contains("arbitrage"))
        assertTrue(csv.contains("5.8"))
    }

    @Test
    fun escape_quotesCommas() {
        val csv = ProCsvExport.build(
            snapshot = null,
            lanes = listOf(
                VehicleLane(
                    make = "Make, Inc",
                    model = "Model \"X\"",
                    listingCount = 1,
                    avgPriceLkr = null,
                    medianPriceLkr = null,
                    minPriceLkr = null,
                    maxPriceLkr = null,
                    avgDealScore = null,
                    districtCount = 1,
                    sourceCount = 1,
                    topDistrict = null,
                    topSource = null,
                    latestSeenAt = null,
                ),
            ),
            districts = emptyList(),
            arbitrage = emptyList(),
        )
        assertTrue(csv.contains("\"Make, Inc\""))
        assertTrue(csv.contains("\"Model \"\"X\"\"\""))
    }
}
