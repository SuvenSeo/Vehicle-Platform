package lk.motormila.app.data

import lk.motormila.app.data.remote.dto.DistrictPriceDto
import lk.motormila.app.data.remote.dto.FmvDto
import lk.motormila.app.data.remote.dto.FuelMixBucketDto
import lk.motormila.app.data.remote.dto.ListingDto
import lk.motormila.app.data.remote.dto.NotificationDto
import lk.motormila.app.data.remote.dto.StatsSummaryDto
import lk.motormila.app.data.remote.dto.TrendPointDto
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.domain.model.DealBand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Pure-JVM contract tests for DTO -> domain mappers (DATA_CONTRACT §1).
 * No Android/Room/Hilt dependencies — safe for testDebugUnitTest.
 */
class DataMappersTest {

    @Test
    fun listing_freeTierNullsStayNullAndLockDealBand() {
        val domain = ListingDto(
            id = 7,
            make = "Toyota",
            model = "Aqua",
            dealScore = null,
            marketMedianLkr = null,
            engineCapacity = 1500,
        ).toDomain()
        assertNull(domain.dealScore)
        assertNull(domain.marketMedianLkr)
        assertEquals(DealBand.LOCKED, domain.dealBand())
        assertEquals(1500.0, domain.engineCc)
    }

    @Test
    fun listing_scoredDealBands() {
        assertEquals(DealBand.GREAT, ListingDto(dealScore = 8.5).toDomain().dealBand())
        assertEquals(DealBand.FAIR, ListingDto(dealScore = 2.0).toDomain().dealBand())
        assertEquals(DealBand.HIGH, ListingDto(dealScore = -3.0).toDomain().dealBand())
    }

    @Test
    fun fmv_nullScoreLocksBand() {
        val fmv = FmvDto(fmvLkr = 5_000_000.0, dealScore = null).toDomain()
        assertEquals(DealBand.LOCKED, fmv.band)
        assertNull(fmv.dealScore)
    }

    @Test
    fun trendPoint_parsesPeriodString() {
        val point = TrendPointDto(year = null, month = null, period = "2024-03").toDomain()
        assertEquals(2024, point.year)
        assertEquals(3, point.month)
    }

    @Test
    fun districtStat_defaultsLatLngToZero() {
        val stat = DistrictPriceDto(district = "Colombo").toDomain()
        assertEquals(0.0, stat.lat, 0.0)
        assertEquals(0.0, stat.lng, 0.0)
    }

    @Test
    fun statsSummary_fallsBackToDistrictCount() {
        val summary = StatsSummaryDto(districtsCovered = 0, districtCount = 25).toDomain()
        assertEquals(25, summary.districtsCovered)
    }

    @Test
    fun fuelMix_shareFractionScaledToPct() {
        val bucket = FuelMixBucketDto(fuelType = "petrol", count = 30, pct = 0.0, share = 0.3).toDomain()
        assertEquals(30.0, bucket.pct, 0.001)
    }

    @Test
    fun notification_listingLinkParsesId() {
        val n = NotificationDto(
            id = 1,
            title = "Price drop",
            link = "https://motormila.vercel.app/listings/42",
            read = false,
            createdAt = "2026-01-01T00:00:00Z",
        ).toDomain()
        assertEquals("listing", n.kind)
        assertEquals(42, n.listingId)
    }

    @Test
    fun notification_plainLinkIsAlertKind() {
        val n = NotificationDto(
            id = 2,
            title = "New matches",
            link = null,
            read = true,
            createdAt = "2026-01-01T00:00:00Z",
        ).toDomain()
        assertEquals("alert", n.kind)
        assertNull(n.listingId)
    }
}
