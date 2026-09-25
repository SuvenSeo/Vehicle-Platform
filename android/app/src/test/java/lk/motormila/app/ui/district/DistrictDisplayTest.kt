package lk.motormila.app.ui.district

import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.DistrictVelocity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DistrictDisplayTest {

    @Test
    fun titleCaseDistrict_splitsHyphensAndUnderscores() {
        assertEquals("Nuwara Eliya", titleCaseDistrict("nuwara-eliya"))
        assertEquals("Sri Lanka", titleCaseDistrict("sri_lanka"))
        assertEquals("Colombo", titleCaseDistrict("COLOMBO"))
        assertEquals("Gampaha", titleCaseDistrict("  gampaha  "))
    }

    @Test
    fun titleCaseDistrict_decodesUrlEncodedSlug() {
        assertEquals("Nuwara Eliya", titleCaseDistrict("Nuwara%20Eliya"))
        assertEquals("Colombo", titleCaseDistrict("colombo"))
    }

    @Test
    fun titleCaseDistrict_blankStaysEmpty() {
        assertEquals("", titleCaseDistrict("   "))
        assertEquals("", titleCaseDistrict(""))
    }

    @Test
    fun displayDistrictName_prefersInsightThenSlug() {
        assertEquals("Colombo", displayDistrictName("Colombo", "colombo"))
        assertEquals("Gampaha", displayDistrictName("  ", "gampaha"))
        assertEquals("Kalutara", displayDistrictName(null, "kalutara"))
        assertEquals("Nuwara Eliya", displayDistrictName("", "nuwara-eliya"))
    }

    @Test
    fun districtMatchKey_ignoresCaseAndSeparators() {
        assertEquals("nuwaraeliya", districtMatchKey("Nuwara-Eliya"))
        assertEquals("nuwaraeliya", districtMatchKey("Nuwara Eliya"))
        assertEquals(districtMatchKey("colombo"), districtMatchKey("Colombo"))
    }

    @Test
    fun nearbyDistricts_excludesCurrentAndRanksByDistance() {
        val colombo = district("Colombo", lat = 6.9271, lng = 79.8612, count = 200)
        val gampaha = district("Gampaha", lat = 7.0840, lng = 80.0100, count = 80)
        val kandy = district("Kandy", lat = 7.2906, lng = 80.6337, count = 40)
        val jaffna = district("Jaffna", lat = 9.6615, lng = 80.0255, count = 12)
        val nearby = nearbyDistricts(
            currentNames = listOf("colombo", "Colombo"),
            prices = listOf(colombo, gampaha, kandy, jaffna),
            velocities = listOf(
                DistrictVelocity(
                    district = "Gampaha",
                    lat = gampaha.lat,
                    lng = gampaha.lng,
                    listingCount = 80,
                    new7dCount = 5,
                    velocityScore = 1.2,
                ),
            ),
        )
        assertEquals(listOf("Gampaha", "Kandy", "Jaffna"), nearby.map { it.district })
        assertEquals(5, nearby.first().new7dCount)
        assertTrue(nearby.none { it.district.equals("Colombo", ignoreCase = true) })
    }

    @Test
    fun nearbyDistricts_fallsBackToCountWhenCurrentMissing() {
        val ranked = nearbyDistricts(
            currentNames = listOf("Unknown"),
            prices = listOf(
                district("A", count = 3),
                district("B", count = 30),
                district("C", count = 10),
            ),
        )
        assertEquals(listOf("B", "C", "A"), ranked.map { it.district })
    }

    private fun district(
        name: String,
        lat: Double = 0.0,
        lng: Double = 0.0,
        count: Int = 1,
    ): DistrictStat = DistrictStat(
        district = name,
        lat = lat,
        lng = lng,
        count = count,
        avgPriceLkr = 8_000_000.0,
        medianPriceLkr = 7_500_000.0,
    )
}
