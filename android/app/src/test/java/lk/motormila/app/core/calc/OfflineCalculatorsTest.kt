package lk.motormila.app.core.calc

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Parity with backend/calculators.py + web offlineCalculators.ts. */
class OfflineCalculatorsTest {

    @Test
    fun landedCost_matchesBackendFor1500ccHybrid() {
        val res = OfflineCalculators.landedCost(
            cifUsd = 12000.0,
            exchangeRate = 300.0,
            fuelType = "hybrid",
            engineCc = 1500,
        )
        assertEquals(3_600_000.0, res.cifLkr, 0.01)
        assertEquals(720_000.0, res.cid, 0.01)
        assertEquals(360_000.0, res.surcharge, 0.01)
        assertEquals(5_775_000.0, res.excise, 0.01)
        assertEquals(261_375.0, res.sscl, 0.01)
        assertEquals(1_928_947.5, res.vat, 0.01)
        assertEquals(0.0, res.luxuryTax, 0.01)
        assertEquals(9_045_322.5, res.totalTax, 0.01)
        assertEquals(12_645_322.5, res.landedCost, 0.01)
    }

    @Test
    fun tco_matchesBackendFallbackMath() {
        val res = OfflineCalculators.tco(
            dailyKm = 40.0,
            fuelType = "petrol",
            mileageKmpl = 15.0,
            leaseInstallment = 0.0,
            insuranceAnnual = 120_000.0,
            serviceAnnual = 60_000.0,
            tyresAnnual = 30_000.0,
            resaleLossAnnual = 100_000.0,
        )
        // 1200 km/mo / 15 kmpl * 410 fallback = 32,800 fuel.
        assertEquals(410.0, res.fuelPriceLkr, 0.01)
        assertEquals(32_800.0, res.fuelCostMonthly, 0.01)
        // (120k + 60k + 30k + 100k) / 12 = 25,833.33 overhead.
        assertEquals(25_833.33, res.overheadCostMonthly, 0.01)
        assertEquals(58_633.33, res.totalTcoMonthly, 0.01)
    }

    @Test
    fun ownershipBundle_matchesBackendForPetrolMotorCar() {
        val res = OfflineCalculators.ownershipBundle(
            vehicleClass = "motor_car",
            fuelType = "petrol",
            engineCc = 1500,
        )
        // 1120 kg estimate -> 4000 band + 1550 emission.
        assertEquals(5_550.0, res.revenueLicenceLkr ?: 0.0, 0.01)
        // 3250 CMT + 25 stamp.
        assertEquals(3_275.0, res.insuranceLkr ?: 0.0, 0.01)
        assertEquals(8_825.0, res.firstYearTotalLkr ?: 0.0, 0.01)
    }

    @Test
    fun benchmarkPermits_hasFourEntries() {
        val permits = OfflineCalculators.benchmarkPermits()
        assertEquals(4, permits.size)
        assertTrue(permits.all { it.marketPriceLkr > 0 })
    }
}
