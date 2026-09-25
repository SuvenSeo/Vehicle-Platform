package lk.motormila.app.ui.permits

import org.junit.Assert.assertEquals
import org.junit.Test

class PermitLabelsTest {
    @Test
    fun displayTypeMapsKnownKeys() {
        assertEquals("Assembled vehicle", PermitLabels.displayType("assembled"))
        assertEquals("Duty-free", PermitLabels.displayType("duty_free"))
        assertEquals("EV / Remittance", PermitLabels.displayType("EV"))
        assertEquals("Unspecified", PermitLabels.displayType("  "))
        assertEquals("Custom lane", PermitLabels.displayType("custom_lane"))
    }

    @Test
    fun uniqueTypeCountIgnoresDuplicates() {
        assertEquals(2, PermitLabels.uniqueTypeCount(listOf("ev", "EV", "duty_free")))
    }
}
