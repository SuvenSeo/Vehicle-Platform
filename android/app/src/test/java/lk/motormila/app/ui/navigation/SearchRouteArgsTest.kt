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
}
