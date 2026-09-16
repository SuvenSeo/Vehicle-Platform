package lk.motormila.app.ui.pricing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PricingCatalogTest {
    @Test
    fun tiersCoverFreeProDealerCustom() {
        val ids = PricingCatalog.tiers.map { it.id }
        assertEquals(listOf("free", "pro", "dealer", "custom"), ids)
        assertTrue(PricingCatalog.tiers.any { it.highlight })
        assertTrue(PricingCatalog.faqs.size >= 4)
        assertEquals(7, PricingCatalog.trialDays)
    }
}
