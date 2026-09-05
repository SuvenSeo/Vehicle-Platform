package lk.motormila.app.ui.valuation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.domain.model.Valuation
import lk.motormila.app.domain.model.ValuationInput
import lk.motormila.app.domain.repository.ListingRepository

data class ValuationForm(
    val make: String = "",
    val model: String = "",
    val year: String = "",
    val condition: String = "Used",
    val transmission: String = "Automatic",
    val fuel: String = "Petrol",
    val mileageKm: String = "",
    val district: String = "Colombo",
)

data class LandedCostInput(
    val cifUsd: String = "",
    val engineCc: String = "",
    val fuel: String = "Petrol",
    val electricKw: String = "",
    val includeClearing: Boolean = true,
    val includeRegistration: Boolean = true,
)

data class LandedCostResult(
    val fxUsed: Double = 0.0,
    val cifLkr: Double = 0.0,
    val exciseLkr: Double = 0.0,
    val vatLkr: Double = 0.0,
    val clearingLkr: Double = 0.0,
    val registrationLkr: Double = 0.0,
    val totalLkr: Double = 0.0,
)

data class LeaseInput(
    val priceLkr: String = "",
    val downPct: String = "20",
    val ratePct: String = "18",
    val years: String = "5",
)

data class TcoInput(
    val kmPerDay: String = "50",
    val kmPerLitre: String = "12",
    val fuelPriceLkr: String = "340",
    val servicePerYearLkr: String = "120000",
    val insurancePerYearLkr: String = "180000",
)

data class ValuationUiState(
    val form: ValuationForm = ValuationForm(),
    val estimating: Boolean = false,
    val result: Valuation? = null,
    val estimateError: String? = null,
    val fxRate: Double? = null,
    val landedInput: LandedCostInput = LandedCostInput(),
    val landed: LandedCostResult? = null,
    val leaseInput: LeaseInput = LeaseInput(),
    val tcoInput: TcoInput = TcoInput(),
    val bundleClass: String = "Car <1000cc",
    val bundleFuel: String = "Petrol",
    val error: String? = null,
)

sealed interface ValuationUiEvent {
    data class FormChanged(val form: ValuationForm) : ValuationUiEvent
    data object Estimate : ValuationUiEvent
    data class LandedChanged(val input: LandedCostInput) : ValuationUiEvent
    data object CalcLanded : ValuationUiEvent
    data class LeaseChanged(val input: LeaseInput) : ValuationUiEvent
    data class TcoChanged(val input: TcoInput) : ValuationUiEvent
    data class BundleChanged(val klass: String, val fuel: String) : ValuationUiEvent
    data object DismissError : ValuationUiEvent
}

@HiltViewModel
class ValuationViewModel @Inject constructor(
    private val listings: ListingRepository,
    private val api: MotormilaApiService,
) : ViewModel() {

    private val _state = MutableStateFlow(ValuationUiState())
    val state: StateFlow<ValuationUiState> = _state.asStateFlow()

    init {
        // Auto FX macro (USD→LKR); falls back to 300 when offline.
        viewModelScope.launch {
            runCatching { api.macro().usdLkr }
                .onSuccess { fx -> _state.update { it.copy(fxRate = fx) } }
        }
    }

    fun onEvent(event: ValuationUiEvent) {
        when (event) {
            is ValuationUiEvent.FormChanged -> _state.update { it.copy(form = event.form, result = null) }
            ValuationUiEvent.Estimate -> estimate()
            is ValuationUiEvent.LandedChanged -> _state.update { it.copy(landedInput = event.input, landed = null) }
            ValuationUiEvent.CalcLanded -> calcLanded()
            is ValuationUiEvent.LeaseChanged -> _state.update { it.copy(leaseInput = event.input) }
            is ValuationUiEvent.TcoChanged -> _state.update { it.copy(tcoInput = event.input) }
            is ValuationUiEvent.BundleChanged -> _state.update { it.copy(bundleClass = event.klass, bundleFuel = event.fuel) }
            ValuationUiEvent.DismissError -> _state.update { it.copy(error = null, estimateError = null) }
        }
    }

    private fun estimate() {
        val f = _state.value.form
        val year = f.year.toIntOrNull()
        val mileage = f.mileageKm.replace(",", "").toIntOrNull()
        if (f.make.isBlank() || f.model.isBlank() || year == null || mileage == null) {
            _state.update { it.copy(estimateError = "Fill make, model, year and mileage to estimate.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(estimating = true, estimateError = null) }
            // Full custom estimate carries transmission/fuel/district (quick estimate drops them).
            runCatching {
                listings.customEstimate(
                    ValuationInput(
                        make = f.make.trim(),
                        model = f.model.trim(),
                        year = year,
                        condition = f.condition,
                        transmission = f.transmission,
                        fuelType = f.fuel,
                        mileageKm = mileage,
                        district = f.district,
                    ),
                )
            }.onSuccess { r -> _state.update { it.copy(estimating = false, result = r) } }
                .onFailure { e ->
                    _state.update { it.copy(estimating = false, estimateError = e.message ?: "Estimate failed.") }
                }
        }
    }

    /**
     * Simplified landed-cost model (documented, review with tax tables before release):
     * excise = cifLkr * rate(cc, fuel) ; VAT = 18% of (cif + excise).
     */
    private fun calcLanded() {
        val i = _state.value.landedInput
        val fx = _state.value.fxRate ?: 300.0
        val cifUsd = i.cifUsd.toDoubleOrNull() ?: 0.0
        val cc = i.engineCc.toIntOrNull() ?: 0
        val kw = i.electricKw.toDoubleOrNull() ?: 0.0
        if (cifUsd <= 0) {
            _state.update { it.copy(error = "Enter a valid CIF in USD.") }
            return
        }
        val cifLkr = cifUsd * fx
        val exciseRate = when {
            i.fuel == "Electric" -> if (kw <= 100) 0.30 else 0.60
            cc <= 1000 -> 1.00
            cc <= 1500 -> 1.50
            cc <= 2000 -> 2.00
            else -> 2.50
        }
        val excise = cifLkr * exciseRate
        val vat = (cifLkr + excise) * 0.18
        val clearing = if (i.includeClearing) 450_000.0 else 0.0
        val registration = if (i.includeRegistration) 250_000.0 else 0.0
        _state.update {
            it.copy(
                landed = LandedCostResult(
                    fxUsed = fx,
                    cifLkr = cifLkr,
                    exciseLkr = excise,
                    vatLkr = vat,
                    clearingLkr = clearing,
                    registrationLkr = registration,
                    totalLkr = cifLkr + excise + vat + clearing + registration,
                ),
            )
        }
    }

    // ---- Pure calculator helpers (used by the Screen, unit-testable) ----

    fun leaseMonthly(): Double {
        val i = _state.value.leaseInput
        val price = i.priceLkr.replace(",", "").toDoubleOrNull() ?: 0.0
        val downPct = i.downPct.toDoubleOrNull() ?: 0.0
        val rate = i.ratePct.toDoubleOrNull() ?: 0.0
        val months = (i.years.toIntOrNull() ?: 0) * 12
        // LTV guard: warn downstream when loan exceeds 80% of price.
        val principal = price * (1 - downPct / 100.0)
        return amortizedMonthly(principal, rate, months)
    }

    /** Standard amortizing-loan payment (no core.format helper exists in this build). */
    private fun amortizedMonthly(principal: Double, annualRatePct: Double, months: Int): Double {
        if (principal <= 0 || months <= 0) return 0.0
        if (annualRatePct <= 0) return principal / months
        val r = annualRatePct / 100.0 / 12.0
        return principal * r / (1 - Math.pow(1 + r, -months.toDouble()))
    }

    fun leaseLtvBreached(): Boolean {
        val down = _state.value.leaseInput.downPct.toDoubleOrNull() ?: 0.0
        return down < 20.0
    }

    fun tcoMonthly(): Double {
        val i = _state.value.tcoInput
        val kmDay = i.kmPerDay.toDoubleOrNull() ?: 0.0
        val kmpl = i.kmPerLitre.toDoubleOrNull() ?: 0.0
        val fuelPrice = i.fuelPriceLkr.toDoubleOrNull() ?: 0.0
        val fuel = if (kmpl > 0) (kmDay * 30 / kmpl) * fuelPrice else 0.0
        val fixed = ((i.servicePerYearLkr.toDoubleOrNull() ?: 0.0) + (i.insurancePerYearLkr.toDoubleOrNull() ?: 0.0)) / 12
        return fuel + fixed
    }

    /** Statutory ownership bundle total for class/fuel (simplified schedule). */
    fun ownershipTotal(): Double = when (_state.value.bundleClass) {
        "Motorcycle" -> 28_000.0
        "Car <1000cc" -> 95_000.0
        "Car 1000–1500cc" -> 135_000.0
        "Car >1500cc" -> 185_000.0
        "SUV / Dual purpose" -> 210_000.0
        else -> 95_000.0
    } + if (_state.value.bundleFuel == "Diesel") 25_000.0 else 0.0

    fun depreciationSchedule(priceLkr: Double): List<Pair<String, Double>> {
        // Straight-line-ish: 12% y1, 9% y2, 8% y3 on written-down value.
        var v = priceLkr
        return listOf(0.12, 0.09, 0.08).mapIndexed { idx, rate ->
            v *= (1 - rate)
            "Year ${idx + 1}" to v
        }
    }
}
