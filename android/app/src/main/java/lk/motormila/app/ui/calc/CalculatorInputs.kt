package lk.motormila.app.ui.calc

import lk.motormila.app.core.format.parseLkrShorthand
import lk.motormila.app.domain.repository.LandedCostInput
import lk.motormila.app.domain.repository.OwnershipBundleInput
import lk.motormila.app.domain.repository.TcoInput

enum class CalculatorTab {
    LANDED,
    TCO,
    LEASE,
    OWNERSHIP,
    PERMITS,
    DEPRECIATION,
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

data class LeaseForm(
    val priceLkr: String = CalculatorInputs.DEFAULT_PRICE_LKR,
    val downPct: String = CalculatorInputs.DEFAULT_LEASE_DOWN_PCT,
    val ratePct: String = CalculatorInputs.DEFAULT_LEASE_RATE_PCT,
    val years: String = CalculatorInputs.DEFAULT_LEASE_YEARS,
)

data class OwnershipForm(
    val vehicleClass: String = "motor_car",
    val fuelType: CalculatorFuelType = CalculatorFuelType.PETROL,
    val engineCc: String = CalculatorInputs.DEFAULT_ENGINE_CC,
    val considerationLkr: String = CalculatorInputs.DEFAULT_PRICE_LKR,
    val includeTransfer: Boolean = true,
)

data class DepreciationForm(
    val priceLkr: String = CalculatorInputs.DEFAULT_PRICE_LKR,
)

data class LeaseQuote(
    val principalLkr: Double,
    val monthlyLkr: Double,
    val totalInterestLkr: Double,
    val totalPaidLkr: Double,
    val ltvBreached: Boolean,
)

data class DepreciationPoint(
    val yearLabel: String,
    val valueLkr: Double,
)

enum class CalculatorValidation {
    CIF_REQUIRED,
    ENGINE_CC_REQUIRED,
    YEAR_INVALID,
    PRICE_REQUIRED,
    MONTHLY_KM_REQUIRED,
    KM_PER_LITRE_REQUIRED,
    YEARS_INVALID,
    DOWN_PCT_INVALID,
    RATE_PCT_INVALID,
    CONSIDERATION_REQUIRED,
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
    const val DEFAULT_LEASE_DOWN_PCT = "50"
    const val DEFAULT_LEASE_RATE_PCT = "18"
    const val DEFAULT_LEASE_YEARS = "5"
    const val DEFAULT_FUEL_PRICE_PER_LITRE = 370.0
    const val DEFAULT_YEAR = 2026
    const val MIN_YEAR = 1980
    const val MAX_YEAR = 2035
    const val MIN_YEARS = 1
    const val MAX_YEARS = 15
    const val HYBRID_EXCISE_CLIFF_CC = 1500
    const val MAX_AMOUNT = 1e12
    const val CBSL_PASSENGER_MIN_DOWN_PCT = 50.0

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

    fun parseLease(form: LeaseForm): CalculatorParseResult<LeaseQuote> {
        val price = parsePositiveAmount(form.priceLkr)
            ?: return CalculatorParseResult.Err(CalculatorValidation.PRICE_REQUIRED)
        val downPct = parseNonNegativeDecimal(form.downPct)
            ?: return CalculatorParseResult.Err(CalculatorValidation.DOWN_PCT_INVALID)
        if (downPct > 100.0) {
            return CalculatorParseResult.Err(CalculatorValidation.DOWN_PCT_INVALID)
        }
        val ratePct = parseNonNegativeDecimal(form.ratePct)
            ?: return CalculatorParseResult.Err(CalculatorValidation.RATE_PCT_INVALID)
        val years = parsePositiveInt(form.years)
        if (years == null || years < MIN_YEARS || years > MAX_YEARS) {
            return CalculatorParseResult.Err(CalculatorValidation.YEARS_INVALID)
        }
        val months = years * 12
        val principal = price * (1.0 - downPct / 100.0)
        val monthly = amortizedMonthly(principal, ratePct, months)
        val totalPaid = monthly * months
        return CalculatorParseResult.Ok(
            LeaseQuote(
                principalLkr = principal,
                monthlyLkr = monthly,
                totalInterestLkr = (totalPaid - principal).coerceAtLeast(0.0),
                totalPaidLkr = totalPaid,
                ltvBreached = downPct < CBSL_PASSENGER_MIN_DOWN_PCT,
            ),
        )
    }

    fun parseOwnership(form: OwnershipForm): CalculatorParseResult<OwnershipBundleInput> {
        val cc = parsePositiveInt(form.engineCc)
        if (form.fuelType.requiresEngineCc && cc == null) {
            return CalculatorParseResult.Err(CalculatorValidation.ENGINE_CC_REQUIRED)
        }
        val consideration = parsePositiveAmount(form.considerationLkr)
            ?: return CalculatorParseResult.Err(CalculatorValidation.CONSIDERATION_REQUIRED)
        return CalculatorParseResult.Ok(
            OwnershipBundleInput(
                vehicleClass = form.vehicleClass.ifBlank { "motor_car" },
                fuelType = form.fuelType.apiValue,
                engineCc = cc ?: 0,
                considerationLkr = consideration,
                includeTransfer = form.includeTransfer,
            ),
        )
    }

    fun parseDepreciation(form: DepreciationForm): CalculatorParseResult<List<DepreciationPoint>> {
        val price = parsePositiveAmount(form.priceLkr)
            ?: return CalculatorParseResult.Err(CalculatorValidation.PRICE_REQUIRED)
        return CalculatorParseResult.Ok(depreciationSchedule(price))
    }

    fun showHybridCliff(form: LandedForm): Boolean {
        if (form.fuelType != CalculatorFuelType.HYBRID) return false
        val cc = parsePositiveInt(form.engineCc) ?: return false
        return cc > HYBRID_EXCISE_CLIFF_CC
    }

    fun amortizedMonthly(principal: Double, annualRatePct: Double, months: Int): Double {
        if (principal <= 0.0 || months <= 0) return 0.0
        if (annualRatePct <= 0.0) return principal / months
        val r = annualRatePct / 100.0 / 12.0
        return principal * r / (1.0 - Math.pow(1.0 + r, -months.toDouble()))
    }

    fun depreciationSchedule(priceLkr: Double): List<DepreciationPoint> {
        var value = priceLkr
        return listOf(0.12, 0.09, 0.08).mapIndexed { index, rate ->
            value *= (1.0 - rate)
            DepreciationPoint(yearLabel = "Year ${index + 1}", valueLkr = value)
        }
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

    fun parseNonNegativeDecimal(raw: String): Double? {
        val cleaned = raw.trim().replace(",", "").replace(" ", "")
        return cleaned.toDoubleOrNull()?.takeIf { it >= 0.0 && it <= MAX_AMOUNT }
    }

    fun parseOptionalYear(raw: String, defaultYear: Int = DEFAULT_YEAR): Int? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return defaultYear
        val year = trimmed.toIntOrNull() ?: return null
        if (year < MIN_YEAR || year > MAX_YEAR) return null
        return year
    }
}
