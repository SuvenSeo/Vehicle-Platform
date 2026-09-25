package lk.motormila.app.ui.scan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Canonical LK plate parser (Swarm E). Pure JVM — no android.*. */
class PlateParserCanonicalTest {

    @Test
    fun normalise_uppercaseAndDash() {
        assertEquals("WP CA-1234", PlateParser.normalise("wp ca 1234"))
        assertEquals("CAB-1234", PlateParser.normalise("  cab-1234 "))
        assertEquals("WP AB-1234", PlateParser.normalise("wp ab 1234"))
        assertEquals("WP-AB-1234", PlateParser.normalise("wp-ab-1234"))
    }

    @Test
    fun extract_provincePlates() {
        val found = PlateParser.extract("For sale WP CAZ 1234 call now")
        assertTrue(found.any { it.contains("1234") })
    }

    @Test
    fun extract_numericLegacy() {
        val found = PlateParser.extract("old car 12-3456 negotiable")
        assertTrue(found.contains("12-3456"))
    }

    @Test
    fun extract_spacelessOcr() {
        val found = PlateParser.extract("WPABC1234")
        assertTrue(found.isNotEmpty())
    }

    @Test
    fun extract_blankAndNoise() {
        assertTrue(PlateParser.extract("").isEmpty())
        assertTrue(PlateParser.extract("no plates here at all").isEmpty())
        assertTrue(PlateParser.extract("call 0771234567").size <= 5)
    }

    @Test
    fun extract_capsAtFive() {
        val text = "CAB-1111 CAD-2222 CAE-3333 CAF-4444 CAG-5555 CAH-6666 CAI-7777"
        assertTrue(PlateParser.extract(text).size <= 5)
    }
}
