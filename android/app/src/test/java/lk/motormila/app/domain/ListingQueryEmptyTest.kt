package lk.motormila.app.domain

import lk.motormila.app.domain.repository.ListingQuery
import lk.motormila.app.domain.repository.ListingSorts
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ListingQueryEmptyTest {

    @Test
    fun defaultAndBlanks_areEmpty() {
        assertTrue(ListingQuery().isEmpty)
        assertTrue(ListingQuery(sort = ListingSorts.DEAL_SCORE).isEmpty)
        assertTrue(
            ListingQuery(
                keyword = "  ",
                make = "",
                model = null,
                district = "\t",
            ).isEmpty,
        )
    }

    @Test
    fun anyConstraint_isNotEmpty() {
        assertFalse(ListingQuery(keyword = "axio").isEmpty)
        assertFalse(ListingQuery(make = "Toyota").isEmpty)
        assertFalse(ListingQuery(district = "Colombo").isEmpty)
        assertFalse(ListingQuery(yearMin = 2017).isEmpty)
        assertFalse(ListingQuery(priceMax = 8_000_000.0).isEmpty)
    }
}
