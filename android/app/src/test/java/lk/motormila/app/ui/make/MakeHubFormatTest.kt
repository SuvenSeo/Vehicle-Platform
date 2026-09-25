package lk.motormila.app.ui.make

import lk.motormila.app.domain.model.TrendPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MakeHubFormatTest {

    @Test
    fun titleCaseSlug_titleCasesHyphenAndUnderscore() {
        assertEquals("Toyota", titleCaseSlug("toyota"))
        assertEquals("Land Cruiser", titleCaseSlug("land-cruiser"))
        assertEquals("Prius C", titleCaseSlug("prius_c"))
        assertEquals("Honda", titleCaseSlug("HONDA"))
        assertEquals("Bmw", titleCaseSlug("bmw"))
    }

    @Test
    fun titleCaseSlug_decodesUrlEncoding() {
        assertEquals("Land Cruiser", titleCaseSlug("land%20cruiser"))
        assertEquals("Toyota", titleCaseSlug("Toyota"))
    }

    @Test
    fun hubDisplayName_prefersCanonical() {
        assertEquals("Toyota", hubDisplayName("Toyota", "toyota"))
        assertEquals("Toyota", hubDisplayName("  Toyota  ", "honda"))
        assertEquals("Toyota", hubDisplayName("", "toyota"))
        assertEquals("Toyota", hubDisplayName(null, "toyota"))
        assertEquals("Toyota", hubDisplayName("   ", "toyota"))
    }

    @Test
    fun hubVehicleLabel_joinsNonBlank() {
        assertEquals("Toyota Aqua", hubVehicleLabel("Toyota", "Aqua"))
        assertEquals("Toyota", hubVehicleLabel("Toyota", ""))
        assertEquals("Aqua", hubVehicleLabel("", "Aqua"))
        assertEquals("", hubVehicleLabel("", ""))
    }

    @Test
    fun searchArg_prefersCanonicalThenDecodedSlug() {
        assertEquals("Toyota", searchArg("Toyota", "toyota"))
        assertEquals("toyota", searchArg("", "toyota"))
        assertEquals("land cruiser", searchArg(null, "land%20cruiser"))
    }

    @Test
    fun trendPointPrice_prefersMedianThenAvg() {
        val withMedian = TrendPoint(
            year = 2026,
            month = 1,
            avgPriceLkr = 4_000_000.0,
            medianPriceLkr = 3_800_000.0,
            listingCount = 4,
        )
        assertEquals(3_800_000.0, trendPointPrice(withMedian))
        val avgOnly = TrendPoint(
            year = 2026,
            month = 2,
            avgPriceLkr = 4_100_000.0,
            medianPriceLkr = null,
            listingCount = 3,
        )
        assertEquals(4_100_000.0, trendPointPrice(avgOnly))
        val empty = TrendPoint(
            year = 2026,
            month = 3,
            avgPriceLkr = null,
            medianPriceLkr = null,
            listingCount = 0,
        )
        assertNull(trendPointPrice(empty))
    }
}
