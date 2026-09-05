package lk.motormila.app.core.format

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FormatShimsTest {

    @Test
    fun price_formatsMillions() {
        assertEquals("Rs. 12.45M", formatLkr(12_450_000.0))
        assertEquals("Rs. 8.95M", formatLkr(8_950_000L))
    }

    @Test
    fun price_nullIsOnRequest() {
        assertEquals("Price on request", formatLkr(null as Double?))
    }

    @Test
    fun shorthand_parsesUnits() {
        assertEquals(8_000_000.0, parseLkrShorthand("8m"))
        assertEquals(8_500_000.0, parseLkrShorthand("8.5M")!!, 0.001)
        assertEquals(12_450_000.0, parseLkrShorthand("12,450,000")!!, 0.001)
        assertEquals(850_000.0, parseLkrShorthand("850k")!!, 0.001)
        assertEquals(8_500_000.0, parseLkrShorthand("85 lakhs")!!, 0.001)
        assertEquals(12_000_000.0, parseLkrShorthand("1.2cr")!!, 0.001)
    }

    @Test
    fun shorthand_rejectsGarbage() {
        assertNull(parseLkrShorthand(""))
        assertNull(parseLkrShorthand("negotiable"))
        assertNull(parseLkrShorthand("8x"))
    }

    @Test
    fun pct_formatsSigned() {
        assertEquals("+2.5%", formatPct(2.5))
        assertEquals("-1.0%", formatPct(-1.0))
        assertEquals("—", formatPct(null))
    }
}
