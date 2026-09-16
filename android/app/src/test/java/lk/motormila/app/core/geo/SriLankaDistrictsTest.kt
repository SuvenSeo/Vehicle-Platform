package lk.motormila.app.core.geo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SriLankaDistrictsTest {
    @Test
    fun coordFor_usesCanonicalWhenLatLngMissing() {
        val (lat, lng) = SriLankaDistricts.coordFor("Colombo", 0.0, 0.0)
        assertEquals(6.9271, lat, 0.0001)
        assertEquals(79.8612, lng, 0.0001)
    }

    @Test
    fun coordFor_keepsLiveCoordinates() {
        val (lat, lng) = SriLankaDistricts.coordFor("Colombo", 6.9, 79.8)
        assertEquals(6.9, lat, 0.0001)
        assertEquals(79.8, lng, 0.0001)
    }

    @Test
    fun project_mapsColomboInsideCanvas() {
        val (lat, lng) = SriLankaDistricts.coords.getValue("Colombo")
        val (x, y) = SriLankaDistricts.project(lat, lng, 400f, 280f)
        assertTrue(x in 18f..382f)
        assertTrue(y in 18f..262f)
    }

    @Test
    fun coversTwentyFiveDistricts() {
        assertEquals(25, SriLankaDistricts.names.size)
        assertEquals(25, SriLankaDistricts.coords.size)
    }
}
