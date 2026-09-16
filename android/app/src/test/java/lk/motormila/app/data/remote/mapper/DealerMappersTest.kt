package lk.motormila.app.data.remote.mapper

import lk.motormila.app.data.remote.dto.DealerClaimResponseDto
import lk.motormila.app.data.remote.dto.UrlBenchmarkResultDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DealerMappersTest {

    @Test
    fun claimResponse_usesClaimIdWhenPresent() {
        val domain = DealerClaimResponseDto(
            id = 7,
            claimId = "token-row",
            status = "pending",
            message = "ok",
            displayName = "Colombo Cars",
            sellerNamePattern = "Axio",
            claimedUrl = "https://ikman.lk/ad/1",
            matchedListings = 4,
        ).toDomain()
        assertEquals("token-row", domain.claimId)
        assertEquals("Colombo Cars", domain.displayName)
        assertEquals("Axio", domain.sellerNamePattern)
        assertEquals("https://ikman.lk/ad/1", domain.claimedUrl)
        assertEquals(4, domain.matchedListings)
    }

    @Test
    fun claimResponse_fallsBackToNumericId() {
        val domain = DealerClaimResponseDto(id = 42, status = "verified").toDomain()
        assertEquals("42", domain.claimId)
        assertEquals("verified", domain.status)
        assertNull(domain.displayName)
    }

    @Test
    fun urlBenchmark_mapsPriceMedianAndGap() {
        val domain = UrlBenchmarkResultDto(
            url = "https://ikman.lk/ad/99",
            listingPrice = 5_000_000.0,
            marketMedian = 5_500_000.0,
            priceGapPct = -9.1,
            error = null,
        ).toDomain()
        assertEquals("https://ikman.lk/ad/99", domain.url)
        assertEquals(5_000_000.0, domain.listingPrice)
        assertEquals(5_500_000.0, domain.marketMedian)
        assertEquals(-9.1, domain.priceGapPct!!, 0.001)
        assertNull(domain.error)
    }
}
