package lk.motormila.app.ui.insights

import lk.motormila.app.domain.model.PriceIndex
import lk.motormila.app.domain.model.PriceIndexPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PriceIndexFormatTest {

    @Test
    fun periodLabel_formatsYearMonth() {
        assertEquals("Jun 2024", PriceIndexFormat.periodLabel("2024-06"))
        assertEquals("Jan 2023", PriceIndexFormat.periodLabel("2023-01"))
        assertEquals("raw", PriceIndexFormat.periodLabel("raw"))
    }

    @Test
    fun pct_isLocaleStable() {
        assertEquals("—", PriceIndexFormat.pct(null))
        assertEquals("+1.2%", PriceIndexFormat.pct(1.24))
        assertEquals("-0.5%", PriceIndexFormat.pct(-0.5))
        assertEquals("0.0%", PriceIndexFormat.pct(0.0))
    }

    @Test
    fun pointsFor_prefersNamedSegment() {
        val overall = listOf(point("2024-01", 100.0))
        val hybrid = listOf(point("2024-01", 108.0))
        val index = PriceIndex(points = overall, segments = mapOf("hybrid" to hybrid))
        assertEquals(overall, PriceIndexFormat.pointsFor(index, "overall"))
        assertEquals(hybrid, PriceIndexFormat.pointsFor(index, "hybrid"))
        assertEquals(overall, PriceIndexFormat.pointsFor(index, "missing"))
        assertEquals(listOf("overall", "hybrid"), PriceIndexFormat.segmentKeys(index))
        assertEquals("All vehicles", PriceIndexFormat.segmentLabel("overall"))
        assertEquals("Hybrid", PriceIndexFormat.segmentLabel("hybrid"))
    }

    @Test
    fun totalChangePct_fromFirstToLast() {
        val points = listOf(point("2024-01", 100.0), point("2024-06", 110.0))
        assertEquals(10.0, PriceIndexFormat.totalChangePct(points)!!, 0.0001)
        assertNull(PriceIndexFormat.totalChangePct(emptyList()))
        assertTrue(PriceIndexFormat.totalChangePct(listOf(point("2024-01", 0.0))) == null)
    }

    private fun point(period: String, value: Double) = PriceIndexPoint(
        period = period,
        indexValue = value,
        medianPriceLkr = 1.0,
        listingCount = 10,
        momChangePct = 1.0,
    )
}
