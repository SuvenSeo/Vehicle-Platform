package lk.motormila.app.ui.pulse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseGuidesTest {
    @Test
    fun match_bySourceAndType() {
        val guide = PulseGuides.match("dmt", "registrations")
        assertNotNull(guide)
        assertEquals("dmt_registrations", guide!!.key)
    }

    @Test
    fun byKey_acceptsGuideAndFallback() {
        assertEquals("customs_tenders", PulseGuides.byKey("customs_tenders")?.key)
        assertEquals("dmt_transfers", PulseGuides.byKey("dmt_transfers")?.key)
        assertTrue(PulseGuides.all.size >= 4)
    }
}
