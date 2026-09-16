package lk.motormila.app.ui.legal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LegalCatalogTest {
    @Test
    fun privacyAndTermsCoverCoreClauses() {
        val privacyHeadings = LegalCatalog.privacy.sections.map { it.heading }
        val termsHeadings = LegalCatalog.terms.sections.map { it.heading }
        assertTrue(privacyHeadings.any { it.contains("What we collect") })
        assertTrue(privacyHeadings.any { it.contains("erasure") })
        assertTrue(termsHeadings.any { it.contains("Acceptance") })
        assertTrue(termsHeadings.any { it.contains("Governing law") })
        assertEquals("privacy", LegalCatalog.byId("privacy").id)
        assertEquals("terms", LegalCatalog.byId("terms").id)
        assertEquals(LegalCatalog.privacy, LegalCatalog.byId("unknown"))
    }
}
