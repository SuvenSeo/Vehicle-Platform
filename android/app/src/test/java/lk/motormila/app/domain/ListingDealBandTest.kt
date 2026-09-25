package lk.motormila.app.domain

import lk.motormila.app.domain.model.DealBand
import lk.motormila.app.domain.model.Listing
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * [Listing.dealBand] thresholds (web client parity): >= 8 GREAT, >= 0 FAIR,
 * < 0 HIGH, null LOCKED. DataMappersTest covers DTO mapping; this hits the
 * domain boundaries plus [Listing.deltaVsMedianPct].
 */
class ListingDealBandTest {

    @Test
    fun dealBand_thresholds() {
        assertEquals(DealBand.GREAT, listing(score = 8.0).dealBand())
        assertEquals(DealBand.FAIR, listing(score = 7.99).dealBand())
        assertEquals(DealBand.FAIR, listing(score = 0.0).dealBand())
        assertEquals(DealBand.HIGH, listing(score = -0.01).dealBand())
        assertEquals(DealBand.LOCKED, listing(score = null).dealBand())
    }

    @Test
    fun deltaVsMedianPct_requiresPriceAndPositiveMedian() {
        assertEquals(-20.0, listing(score = 1.0, price = 8_000_000.0, median = 10_000_000.0).deltaVsMedianPct()!!, 0.001)
        assertNull(listing(score = 1.0, price = 8_000_000.0, median = null).deltaVsMedianPct())
        assertNull(listing(score = 1.0, price = null, median = 10_000_000.0).deltaVsMedianPct())
        assertNull(listing(score = 1.0, price = 8_000_000.0, median = 0.0).deltaVsMedianPct())
    }

    private fun listing(
        score: Double?,
        price: Double? = 5_000_000.0,
        median: Double? = 5_000_000.0,
    ): Listing = Listing(
        id = 1,
        title = "Toyota Aqua",
        make = "Toyota",
        model = "Aqua",
        year = 2017,
        priceLkr = price,
        mileageKm = null,
        fuelType = null,
        transmission = null,
        condition = null,
        bodyType = null,
        district = null,
        city = null,
        source = null,
        thumbnailUrl = null,
        dealScore = score,
        marketMedianLkr = median,
        scrapedAt = null,
        firstSeenAt = null,
        lastSeenAt = null,
        detailUrl = null,
        externalUrl = null,
        engineCc = null,
    )
}
