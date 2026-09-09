package lk.motormila.app.ui.navigation

import lk.motormila.app.domain.repository.ListingSorts
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Primitive Search args → [lk.motormila.app.domain.repository.ListingQuery]. Pure JVM. */
class SearchRouteArgsTest {

    @Test
    fun searchArgsToQuery_mapsMakeDistrictSort() {
        val query = searchArgsToQuery(
            Search(
                q = " axio ",
                district = "Colombo",
                make = "Toyota",
                model = "Axio",
                sort = ListingSorts.PRICE_ASC,
            ),
        )
        assertEquals("axio", query.keyword)
        assertEquals("Colombo", query.district)
        assertEquals("Toyota", query.make)
        assertEquals("Axio", query.model)
        assertEquals(ListingSorts.PRICE_ASC, query.sort)
        assertFalse(query.isEmpty)
    }

    @Test
    fun searchArgsToQuery_qWinsPlateIsFallback() {
        val both = searchArgsToQuery(q = "axio", plate = " CAB-1234 ")
        assertEquals("axio", both.keyword)

        val plateOnly = searchArgsToQuery(
            q = "  ",
            district = "  ",
            make = "",
            model = null,
            sort = "  ",
            plate = " CAB-1234 ",
        )
        assertEquals("CAB-1234", plateOnly.keyword)
        assertNull(plateOnly.district)
        assertNull(plateOnly.make)
        assertNull(plateOnly.model)
        assertEquals(ListingSorts.NEWEST, plateOnly.sort)
        assertTrue(searchArgsToQuery().isEmpty)
    }

    @Test
    fun isBottomBarRoute_onlyTabDestinations() {
        assertTrue(isBottomBarRoute(Home::class.qualifiedName))
        assertTrue(isBottomBarRoute(Search::class.qualifiedName))
        assertTrue(isBottomBarRoute(Watchlist::class.qualifiedName))
        assertFalse(isBottomBarRoute(ListingDetail::class.qualifiedName))
        assertFalse(isBottomBarRoute(null))
    }

    @Test
    fun resolveMotormilaDeepLink_hubsAndCalculator() {
        val cars = resolveMotormilaDeepLink("motormila://cars/toyota/axio")
        assertTrue(cars is MakeModelHub)
        assertEquals("toyota", (cars as MakeModelHub).make)
        assertEquals("axio", cars.model)

        val make = resolveMotormilaDeepLink("motormila://cars/honda")
        assertTrue(make is MakeHub)
        assertEquals("honda", (make as MakeHub).make)

        val district = resolveMotormilaDeepLink("motormila://locations/Colombo")
        assertTrue(district is DistrictHub)
        assertEquals("Colombo", (district as DistrictHub).district)

        assertTrue(resolveMotormilaDeepLink("motormila://calculator") is Calculator)
        assertTrue(
            resolveMotormilaDeepLink("https://motormila.vercel.app/cars/toyota/aqua") is MakeModelHub,
        )
    }
}
