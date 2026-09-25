package lk.motormila.app.ui.scan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlateParserTest {

    @Test
    fun normalise_collapsesSpacing() {
        assertEquals("WP CA-1234", normalisePlate("wp ca 1234"))
        assertEquals("CAB-1234", normalisePlate("  cab-1234 "))
    }

    @Test
    fun extract_findsPlateCandidates() {
        val found = extractPlateCandidates("For sale WP CAZ 1234 call 0771234567")
        assertTrue(found.any { it.contains("1234") })
    }

    @Test
    fun extract_ignoresBlank() {
        assertTrue(extractPlateCandidates("").isEmpty())
        assertTrue(extractPlateCandidates("no plates here at all").isEmpty())
    }
}
