package lk.motormila.app.ui.calc

import lk.motormila.app.core.format.parseLkrShorthand
import lk.motormila.app.domain.repository.LandedCostInput
import lk.motormila.app.domain.repository.TcoInput

enum class CalculatorTab {
    LANDED,
    TCO,
}

enum class CalculatorFuelType(val apiValue: String) {
    PETROL("petrol"),
    DIESEL("diesel"),
    HYBRID("hybrid"),
    ELECTRIC("electric"),
    ;

    val requiresEngineCc: Boolean
        get() = this != ELECTRIC

    companion object {
        fun fromApi(raw: String): CalculatorFuelType {
            val key = raw.trim().lowercase()
            return entries.firstOrNull { it.apiValue == key } ?: PETROL
        }
    }
}

data class LandedForm(
    val cifLkr: String = CalculatorInputs.DEFAULT_CIF_LKR,
    val engineCc: String = CalculatorInputs.DEFAULT_ENGINE_CC,
    val fuelType: CalculatorFuelType = CalculatorFuelType.HYBRID,
    val year: String = "",
)

data class TcoForm(
    val priceLkr: String = CalculatorInputs.DEFAULT_PRICE_LKR,
    val monthlyKm: String = CalculatorInputs.DEFAULT_MONTHLY_KM,
    val kmPerLitre: String = CalculatorInputs.DEFAULT_KM_PER_LITRE,
    val years: String = CalculatorInputs.DEFAULT_YEARS,
)

enum class CalculatorValidation {
    CIF_REQUIRED,
    ENGINE_CC_REQUIRED,
    YEAR_INVALID,
    PRICE_REQUIRED,
    MONTHLY_KM_REQUIRED,
    KM_PER_LITRE_REQUIRED,
    YEARS_INVALID,
}

sealed interface CalculatorParseResult<out T> {
    data class Ok<T>(val value: T) : CalculatorParseResult<T>
    data class Err(val reason: CalculatorValidation) : CalculatorParseResult<Nothing>
}

/**
 * Pure parsing for calculator forms. Keeps POSTs off the keystroke path:
 * the ViewModel only calls the repository from Calculate actions.
 */
object CalculatorInputs {
    const val DEFAULT_CIF_LKR = "3600000"
    const val DEFAULT_ENGINE_CC = "1500"
    const val DEFAULT_PRICE_LKR = "15000000"
    const val DEFAULT_MONTHLY_KM = "1200"
    const val DEFAULT_KM_PER_LITRE = "18"
    const val DEFAULT_YEARS = "5"
    const val DEFAULT_FUEL_PRICE_PER_LITRE = 370.0
    const val DEFAULT_YEAR = 2026
    const val MIN_YEAR = 1980
    const val MAX_YEAR = 2035
    const val MIN_YEARS = 1
    const val MAX_YEARS = 15
    const val HYBRID_EXCISE_CLIFF_CC = 1500
    const val MAX_AMOUNT = 1e12

    fun parseLanded(
        form: LandedForm,
        defaultYear: Int = DEFAULT_YEAR,
    ): CalculatorParseResult<LandedCostInput> {
        val cif = parsePositiveAmount(form.cifLkr)
            ?: return CalculatorParseResult.Err(CalculatorValidation.CIF_REQUIRED)
        val cc = parsePositiveInt(form.engineCc)
        if (form.fuelType.requiresEngineCc && cc == null) {
            return CalculatorParseResult.Err(CalculatorValidation.ENGINE_CC_REQUIRED)
        }
        val year = parseOptionalYear(form.year, defaultYear)
            ?: return CalculatorParseResult.Err(CalculatorValidation.YEAR_INVALID)
        return CalculatorParseResult.Ok(
            LandedCostInput(
                cifValueLkr = cif,
                engineCc = cc ?: 0,
                year = year,
                fuelType = form.fuelType.apiValue,
            ),
        )
    }

    fun parseTco(form: TcoForm): CalculatorParseResult<TcoInput> {
        val price = parsePositiveAmount(form.priceLkr)
            ?: return CalculatorParseResult.Err(CalculatorValidation.PRICE_REQUIRED)
        val monthlyKm = parsePositiveInt(form.monthlyKm)
            ?: return CalculatorParseResult.Err(CalculatorValidation.MONTHLY_KM_REQUIRED)
        val kmPerLitre = parsePositiveDecimal(form.kmPerLitre)
            ?: return CalculatorParseResult.Err(CalculatorValidation.KM_PER_LITRE_REQUIRED)
        val years = parsePositiveInt(form.years)
        if (years == null || years < MIN_YEARS || years > MAX_YEARS) {
            return CalculatorParseResult.Err(CalculatorValidation.YEARS_INVALID)
        }
        return CalculatorParseResult.Ok(
            TcoInput(
                priceLkr = price,
                monthlyKm = monthlyKm,
                fuelPricePerLitre = DEFAULT_FUEL_PRICE_PER_LITRE,
                kmPerLitre = kmPerLitre,
                years = years,
            ),
        )
    }

    fun showHybridCliff(form: LandedForm): Boolean {
        if (form.fuelType != CalculatorFuelType.HYBRID) return false
        val cc = parsePositiveInt(form.engineCc) ?: return false
        return cc > HYBRID_EXCISE_CLIFF_CC
    }

    fun parsePositiveAmount(raw: String): Double? {
        val value = parseLkrShorthand(raw) ?: return null
        if (value <= 0.0 || value > MAX_AMOUNT) return null
        return value
    }

    fun parsePositiveInt(raw: String): Int? {
        val cleaned = raw.trim().replace(",", "").replace(" ", "")
        return cleaned.toIntOrNull()?.takeIf { it > 0 }
    }

    fun parsePositiveDecimal(raw: String): Double? {
        val cleaned = raw.trim().replace(",", "").replace(" ", "")
        return cleaned.toDoubleOrNull()?.takeIf { it > 0.0 && it <= MAX_AMOUNT }
    }

    fun parseOptionalYear(raw: String, defaultYear: Int = DEFAULT_YEAR): Int? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return defaultYear
        val year = trimmed.toIntOrNull() ?: return null
        if (year < MIN_YEAR || year > MAX_YEAR) return null
        return year
    }
}
