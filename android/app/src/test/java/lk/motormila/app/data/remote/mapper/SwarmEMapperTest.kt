package lk.motormila.app.data.remote.mapper

import lk.motormila.app.data.remote.dto.FmvDto
import lk.motormila.app.data.remote.dto.StatsSummaryDto
import lk.motormila.app.data.remote.dto.TrendPointDto
import lk.motormila.app.domain.model.DealBand
import org.junit.Assert.assertEquals
import org.junit.Test

/** Mapper edge cases Swarm E touches (widget/workers/FMV badges). Pure JVM. */
class SwarmEMapperTest {

    @Test
    fun fmv_nullScore_isLocked() {
        val fmv = FmvDto(fmvLkr = 8_000_000.0, dealScore = null).toDomain()
        assertEquals(DealBand.LOCKED, fmv.band)
    }

    @Test
    fun fmv_priceGapNegated() {
        val fmv = FmvDto(fmvLkr = 8_000_000.0, dealScore = 9.0, priceGapPct = 6.8).toDomain()
        assertEquals(DealBand.GREAT, fmv.band)
        assertEquals(-6.8, fmv.deltaPct!!, 0.001)
    }

    @Test
    fun summary_districtCountFallback() {
        val s = StatsSummaryDto(districtsCovered = 0, districtCount = 25).toDomain()
        assertEquals(25, s.districtsCovered)
    }

    @Test
    fun trend_periodStringParsed() {
        val p = TrendPointDto(period = "2024-03").toDomain()
        assertEquals(2024, p.year)
        assertEquals(3, p.month)
    }
}
