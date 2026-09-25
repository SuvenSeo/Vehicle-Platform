package lk.motormila.app.ui.docs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DocsCatalogTest {
    @Test
    fun sectionsCoverCoreProduct() {
        val ids = DocsCatalog.sections.map { it.id }
        assertTrue(ids.containsAll(listOf("overview", "deal-scores", "official-pulse", "calculator", "pricing-access")))
        assertNotNull(DocsCatalog.byId("deal-scores"))
        assertEquals("How deal scores work", DocsCatalog.byId("deal-scores")?.title)
    }
}
