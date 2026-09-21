package lk.motormila.app.data.repository

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import lk.motormila.app.data.remote.dto.ListingDto
import lk.motormila.app.data.remote.dto.PriceSparklinesDto
import lk.motormila.app.domain.repository.ListingQuery
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class SnapshotFallbackTest {

    private fun row(
        id: Int,
        make: String = "Toyota",
        model: String = "Aqua",
        price: Double? = 8_450_000.0,
        district: String? = "Colombo",
    ) = ListingDto(id = id, make = make, model = model, priceLkr = price, district = district)

    @Test
    fun filterSnapshotListings_matchesQueryFields() {
        val rows = listOf(
            row(1, make = "Toyota", model = "Aqua", district = "Colombo"),
            row(2, make = "Honda", model = "Fit", district = "Kandy"),
            row(3, make = "Toyota", model = "Prius", district = "Colombo", price = 12_000_000.0),
        )
        val byMake = filterSnapshotListings(rows, ListingQuery(make = "toyota"))
        assertEquals(listOf(1, 3), byMake.map { it.id })

        val byDistrictPrice = filterSnapshotListings(
            rows,
            ListingQuery(district = "Colombo", priceMax = 9_000_000.0),
        )
        assertEquals(listOf(1), byDistrictPrice.map { it.id })

        val byKeyword = filterSnapshotListings(rows, ListingQuery(keyword = "prius"))
        assertEquals(listOf(3), byKeyword.map { it.id })
    }

    @Test
    fun similarFromSnapshot_mirrorsBackendBand() {
        val rows = listOf(
            row(1, price = 8_450_000.0),
            row(2, price = 8_000_000.0),
            row(3, price = 12_000_000.0),
            row(4, make = "Honda", price = 8_400_000.0),
        )
        val similar = similarFromSnapshot(rows, id = 1, limit = 6)
        assertEquals(listOf(2), similar.map { it.id })
    }

    @Test
    fun similarFromSnapshot_emptyWhenBaseMissing() {
        assertTrue(similarFromSnapshot(listOf(row(1)), id = 999, limit = 6).isEmpty())
    }

    @Test
    fun priceHistoryFromSparklines_mirrorsBackendSummary() {
        val dto = PriceSparklinesDto(
            sparklines = mapOf(
                "7" to listOf(
                    listOf(JsonPrimitive(9_000_000.0), JsonPrimitive("2026-09-01T00:00:00Z")),
                    listOf(JsonPrimitive(8_700_000.0), JsonPrimitive("2026-09-05T00:00:00Z")),
                    listOf(JsonPrimitive(8_450_000.0), JsonPrimitive("2026-09-10T00:00:00Z")),
                ),
            ),
        )
        val history = priceHistoryFromSparklines(dto, 7)!!
        assertEquals(7, history.listingId)
        assertEquals(3, history.points.size)
        assertEquals(9_000_000.0, history.firstPriceLkr!!, 0.01)
        assertEquals(8_450_000.0, history.currentPriceLkr!!, 0.01)
        assertEquals(2, history.cutCount)
        assertEquals(0, history.raiseCount)
        assertEquals("2026-09-10T00:00:00Z", history.lastChangeAt)
    }

    @Test
    fun priceHistoryFromSparklines_nullWhenMissing() {
        assertNull(priceHistoryFromSparklines(PriceSparklinesDto(), 42))
    }

    @Test
    fun withSnapshotFallback_prefersLive() = runTest {
        val result = withSnapshotFallback(
            live = { "live" },
            snapshot = { "snapshot" },
        )
        assertEquals("live", result)
    }

    @Test
    fun withSnapshotFallback_usesSnapshotWhenLiveThrows() = runTest {
        val result = withSnapshotFallback(
            live = { throw IllegalStateException("db down") },
            snapshot = { "snapshot" },
        )
        assertEquals("snapshot", result)
    }

    @Test
    fun withSnapshotFallback_throwsWhenBothFail() = runTest {
        try {
            withSnapshotFallback<String>(
                live = { throw IllegalStateException("db down") },
                snapshot = { throw IllegalStateException("no snapshot") },
            )
            fail("expected throw")
        } catch (e: IllegalStateException) {
            assertEquals("no snapshot", e.message)
            assertEquals(1, e.suppressed.size)
        }
    }
}
