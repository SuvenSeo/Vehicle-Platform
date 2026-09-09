package lk.motormila.app.ui.calc

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CalculatorInputsTest {

    @Test
    fun parseLanded_acceptsShorthandCif() {
        val parsed = CalculatorInputs.parseLanded(
            LandedForm(cifLkr = "3.6m", engineCc = "1500", fuelType = CalculatorFuelType.HYBRID),
        )
        assertTrue(parsed is CalculatorParseResult.Ok)
        val input = (parsed as CalculatorParseResult.Ok).value
        assertEquals(3_600_000.0, input.cifValueLkr, 0.001)
        assertEquals(1500, input.engineCc)
        assertEquals("hybrid", input.fuelType)
        assertEquals(CalculatorInputs.DEFAULT_YEAR, input.year)
    }

    @Test
    fun parseLanded_rejectsBlankCif() {
        val parsed = CalculatorInputs.parseLanded(LandedForm(cifLkr = "", engineCc = "1500"))
        assertEquals(CalculatorValidation.CIF_REQUIRED, (parsed as CalculatorParseResult.Err).reason)
    }

    @Test
    fun parseLanded_requiresEngineCcForPetrol() {
        val parsed = CalculatorInputs.parseLanded(
            LandedForm(cifLkr = "8m", engineCc = "", fuelType = CalculatorFuelType.PETROL),
        )
        assertEquals(CalculatorValidation.ENGINE_CC_REQUIRED, (parsed as CalculatorParseResult.Err).reason)
    }

    @Test
    fun parseLanded_electricSkipsEngineCc() {
        val parsed = CalculatorInputs.parseLanded(
            LandedForm(cifLkr = "4m", engineCc = "", fuelType = CalculatorFuelType.ELECTRIC),
        )
        assertTrue(parsed is CalculatorParseResult.Ok)
        assertEquals(0, (parsed as CalculatorParseResult.Ok).value.engineCc)
        assertEquals("electric", parsed.value.fuelType)
    }

    @Test
    fun parseLanded_optionalYearAndInvalidYear() {
        val ok = CalculatorInputs.parseLanded(
            LandedForm(cifLkr = "5m", engineCc = "1000", year = "2018"),
            defaultYear = 2026,
        )
        assertEquals(2018, (ok as CalculatorParseResult.Ok).value.year)

        val blank = CalculatorInputs.parseLanded(
            LandedForm(cifLkr = "5m", engineCc = "1000", year = ""),
            defaultYear = 2024,
        )
        assertEquals(2024, (blank as CalculatorParseResult.Ok).value.year)

        val bad = CalculatorInputs.parseLanded(
            LandedForm(cifLkr = "5m", engineCc = "1000", year = "1970"),
        )
        assertEquals(CalculatorValidation.YEAR_INVALID, (bad as CalculatorParseResult.Err).reason)
    }

    @Test
    fun parseTco_acceptsShorthandPrice() {
        val parsed = CalculatorInputs.parseTco(
            TcoForm(priceLkr = "15m", monthlyKm = "1,200", kmPerLitre = "18.5", years = "5"),
        )
        assertTrue(parsed is CalculatorParseResult.Ok)
        val input = (parsed as CalculatorParseResult.Ok).value
        assertEquals(15_000_000.0, input.priceLkr, 0.001)
        assertEquals(1200, input.monthlyKm)
        assertEquals(18.5, input.kmPerLitre, 0.001)
        assertEquals(5, input.years)
        assertEquals(CalculatorInputs.DEFAULT_FUEL_PRICE_PER_LITRE, input.fuelPricePerLitre, 0.001)
    }

    @Test
    fun parseTco_rejectsInvalidFields() {
        assertEquals(
            CalculatorValidation.PRICE_REQUIRED,
            (CalculatorInputs.parseTco(TcoForm(priceLkr = "negotiable")) as CalculatorParseResult.Err).reason,
        )
        assertEquals(
            CalculatorValidation.MONTHLY_KM_REQUIRED,
            (CalculatorInputs.parseTco(TcoForm(monthlyKm = "0")) as CalculatorParseResult.Err).reason,
        )
        assertEquals(
            CalculatorValidation.KM_PER_LITRE_REQUIRED,
            (CalculatorInputs.parseTco(TcoForm(kmPerLitre = "0")) as CalculatorParseResult.Err).reason,
        )
        assertEquals(
            CalculatorValidation.YEARS_INVALID,
            (CalculatorInputs.parseTco(TcoForm(years = "20")) as CalculatorParseResult.Err).reason,
        )
    }

    @Test
    fun hybridCliff_onlyAbove1500Hybrid() {
        assertTrue(
            CalculatorInputs.showHybridCliff(
                LandedForm(engineCc = "1800", fuelType = CalculatorFuelType.HYBRID),
            ),
        )
        assertFalse(
            CalculatorInputs.showHybridCliff(
                LandedForm(engineCc = "1500", fuelType = CalculatorFuelType.HYBRID),
            ),
        )
        assertFalse(
            CalculatorInputs.showHybridCliff(
                LandedForm(engineCc = "1800", fuelType = CalculatorFuelType.PETROL),
            ),
        )
    }

    @Test
    fun fuelType_fromApiFallsBackToPetrol() {
        assertEquals(CalculatorFuelType.DIESEL, CalculatorFuelType.fromApi("Diesel"))
        assertEquals(CalculatorFuelType.PETROL, CalculatorFuelType.fromApi("unknown"))
    }

    @Test
    fun parseHelpers_rejectGarbage() {
        assertNull(CalculatorInputs.parsePositiveAmount(""))
        assertNull(CalculatorInputs.parsePositiveAmount("8x"))
        assertNull(CalculatorInputs.parsePositiveInt("cc"))
        assertNull(CalculatorInputs.parseOptionalYear("abcd"))
        assertEquals(2026, CalculatorInputs.parseOptionalYear(""))
    }
}
