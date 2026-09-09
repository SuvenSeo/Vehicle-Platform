package lk.motormila.app.ui.alerts

import lk.motormila.app.core.format.parseLkrShorthand
import org.junit.Assert.assertEquals
import org.junit.Test

/** Pure JVM coverage for alert-form price shorthand used when prefilling from a listing. */
class FormatLkrShorthandTest {

    @Test
    fun millions_usesLowercaseM() {
        assertEquals("8.5m", formatLkrShorthand(8_500_000.0))
        assertEquals("8m", formatLkrShorthand(8_000_000.0))
        assertEquals("12.45m", formatLkrShorthand(12_450_000.0))
    }

    @Test
    fun belowMillion_isWholeRupees() {
        assertEquals("850000", formatLkrShorthand(850_000.0))
        assertEquals("0", formatLkrShorthand(0.0))
    }

    @Test
    fun roundTrip_parseLkrShorthand() {
        val samples = listOf(8_500_000.0, 8_000_000.0, 12_450_000.0, 850_000.0)
        for (value in samples) {
            assertEquals(value, parseLkrShorthand(formatLkrShorthand(value))!!, 0.001)
        }
    }
}
