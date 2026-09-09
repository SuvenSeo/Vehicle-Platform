package lk.motormila.app.ui.scan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/** Voice transcript → ListingQuery heuristic. Pure JVM. Swarm E owned. */
class VoiceQueryParserTest {

    @Test
    fun parsesMakeModelYearPriceDistrict() {
        val q = parseVoiceQuery("Axio 2017 under 8m Colombo")
        assertEquals("Axio", q.make)
        assertEquals(Integer.valueOf(2017), q.yearMin)
        assertEquals(Integer.valueOf(2017), q.yearMax)
        assertEquals("Colombo", q.district)
        assertNotNull(q.priceMax)
    }

    @Test
    fun blankishTranscript_keepsKeyword() {
        val q = parseVoiceQuery("show me cars")
        assertEquals("show me cars", q.keyword)
    }

    @Test
    fun sinhalaDigits_fallBackToKeyword() {
        val q = parseVoiceQuery("Toyota Prius")
        assertEquals("Toyota", q.make)
        assertEquals("Prius", q.model)
    }
}
