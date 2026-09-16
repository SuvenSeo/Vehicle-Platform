package lk.motormila.app.ui.calc

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.core.common.AppError
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.domain.repository.LandedCost
import lk.motormila.app.domain.repository.OwnershipBundle
import lk.motormila.app.domain.repository.PermitQuote
import lk.motormila.app.domain.repository.Tco
import lk.motormila.app.domain.repository.ValuationRepository
import lk.motormila.app.domain.usecase.ObserveSessionUseCase

data class CalculatorUiState(
    val unlocked: Boolean = false,
    val tab: CalculatorTab = CalculatorTab.LANDED,
    val landedForm: LandedForm = LandedForm(),
    val tcoForm: TcoForm = TcoForm(),
    val leaseForm: LeaseForm = LeaseForm(),
    val ownershipForm: OwnershipForm = OwnershipForm(),
    val depreciationForm: DepreciationForm = DepreciationForm(),
    val landed: LandedCost? = null,
    val tco: Tco? = null,
    val lease: LeaseQuote? = null,
    val ownership: OwnershipBundle? = null,
    val permits: List<PermitQuote> = emptyList(),
    val depreciation: List<DepreciationPoint> = emptyList(),
    val calculatingLanded: Boolean = false,
    val calculatingTco: Boolean = false,
    val calculatingOwnership: Boolean = false,
    val loadingPermits: Boolean = false,
    val offline: Boolean = false,
    val error: String? = null,
    val validation: CalculatorValidation? = null,
)

sealed interface CalculatorUiEvent {
    data class TabSelected(val tab: CalculatorTab) : CalculatorUiEvent
    data class LandedFormChanged(val form: LandedForm) : CalculatorUiEvent
    data object CalculateLanded : CalculatorUiEvent
    data class TcoFormChanged(val form: TcoForm) : CalculatorUiEvent
    data object CalculateTco : CalculatorUiEvent
    data class LeaseFormChanged(val form: LeaseForm) : CalculatorUiEvent
    data object CalculateLease : CalculatorUiEvent
    data class OwnershipFormChanged(val form: OwnershipForm) : CalculatorUiEvent
    data object CalculateOwnership : CalculatorUiEvent
    data object LoadPermits : CalculatorUiEvent
    data class DepreciationFormChanged(val form: DepreciationForm) : CalculatorUiEvent
    data object CalculateDepreciation : CalculatorUiEvent
    data object DismissError : CalculatorUiEvent
}

@HiltViewModel
class CalculatorViewModel @Inject constructor(
    private val repository: ValuationRepository,
    observeSession: ObserveSessionUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow(CalculatorUiState())
    val state: StateFlow<CalculatorUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            observeSession().collect { session ->
                val unlocked = session?.isPro == true || session?.isAdmin == true
                _state.update { it.copy(unlocked = unlocked) }
            }
        }
    }

    fun onEvent(event: CalculatorUiEvent) {
        when (event) {
            is CalculatorUiEvent.TabSelected -> {
                _state.update { it.copy(tab = event.tab, validation = null) }
                if (event.tab == CalculatorTab.PERMITS && _state.value.unlocked) {
                    loadPermits()
                }
            }
            is CalculatorUiEvent.LandedFormChanged ->
                _state.update { it.copy(landedForm = event.form, validation = null) }
            CalculatorUiEvent.CalculateLanded -> calculateLanded()
            is CalculatorUiEvent.TcoFormChanged ->
                _state.update { it.copy(tcoForm = event.form, validation = null) }
            CalculatorUiEvent.CalculateTco -> calculateTco()
            is CalculatorUiEvent.LeaseFormChanged ->
                _state.update { it.copy(leaseForm = event.form, validation = null) }
            CalculatorUiEvent.CalculateLease -> calculateLease()
            is CalculatorUiEvent.OwnershipFormChanged ->
                _state.update { it.copy(ownershipForm = event.form, validation = null) }
            CalculatorUiEvent.CalculateOwnership -> calculateOwnership()
            CalculatorUiEvent.LoadPermits -> loadPermits()
            is CalculatorUiEvent.DepreciationFormChanged ->
                _state.update { it.copy(depreciationForm = event.form, validation = null) }
            CalculatorUiEvent.CalculateDepreciation -> calculateDepreciation()
            CalculatorUiEvent.DismissError ->
                _state.update { it.copy(error = null) }
        }
    }

    private fun calculateLanded() {
        if (_state.value.calculatingLanded) return
        when (val parsed = CalculatorInputs.parseLanded(_state.value.landedForm)) {
            is CalculatorParseResult.Err ->
                _state.update { it.copy(validation = parsed.reason, error = null) }
            is CalculatorParseResult.Ok -> viewModelScope.launch {
                _state.update {
                    it.copy(
                        calculatingLanded = true,
                        validation = null,
                        error = null,
                        offline = false,
                    )
                }
                runCatching { repository.landedCost(parsed.value) }
                    .onSuccess { result ->
                        _state.update {
                            it.copy(
                                calculatingLanded = false,
                                landed = result,
                                error = null,
                                offline = false,
                            )
                        }
                    }
                    .onFailure { e -> applyFailure(e, Flag.LANDED) }
            }
        }
    }

    private fun calculateTco() {
        if (!_state.value.unlocked) return
        if (_state.value.calculatingTco) return
        when (val parsed = CalculatorInputs.parseTco(_state.value.tcoForm)) {
            is CalculatorParseResult.Err ->
                _state.update { it.copy(validation = parsed.reason, error = null) }
            is CalculatorParseResult.Ok -> viewModelScope.launch {
                _state.update {
                    it.copy(
                        calculatingTco = true,
                        validation = null,
                        error = null,
                        offline = false,
                    )
                }
                runCatching { repository.tco(parsed.value) }
                    .onSuccess { result ->
                        _state.update {
                            it.copy(
                                calculatingTco = false,
                                tco = result,
                                error = null,
                                offline = false,
                            )
                        }
                    }
                    .onFailure { e -> applyFailure(e, Flag.TCO) }
            }
        }
    }

    private fun calculateLease() {
        if (!_state.value.unlocked) return
        when (val parsed = CalculatorInputs.parseLease(_state.value.leaseForm)) {
            is CalculatorParseResult.Err ->
                _state.update { it.copy(validation = parsed.reason, error = null, lease = null) }
            is CalculatorParseResult.Ok ->
                _state.update {
                    it.copy(lease = parsed.value, validation = null, error = null)
                }
        }
    }

    private fun calculateOwnership() {
        if (!_state.value.unlocked) return
        if (_state.value.calculatingOwnership) return
        when (val parsed = CalculatorInputs.parseOwnership(_state.value.ownershipForm)) {
            is CalculatorParseResult.Err ->
                _state.update { it.copy(validation = parsed.reason, error = null) }
            is CalculatorParseResult.Ok -> viewModelScope.launch {
                _state.update {
                    it.copy(
                        calculatingOwnership = true,
                        validation = null,
                        error = null,
                        offline = false,
                    )
                }
                runCatching { repository.ownershipBundle(parsed.value) }
                    .onSuccess { result ->
                        _state.update {
                            it.copy(
                                calculatingOwnership = false,
                                ownership = result,
                                error = null,
                                offline = false,
                            )
                        }
                    }
                    .onFailure { e -> applyFailure(e, Flag.OWNERSHIP) }
            }
        }
    }

    private fun loadPermits() {
        if (!_state.value.unlocked) return
        if (_state.value.loadingPermits) return
        viewModelScope.launch {
            _state.update {
                it.copy(loadingPermits = true, validation = null, error = null, offline = false)
            }
            runCatching { repository.permits() }
                .onSuccess { rows ->
                    _state.update {
                        it.copy(
                            loadingPermits = false,
                            permits = rows,
                            error = null,
                            offline = false,
                        )
                    }
                }
                .onFailure { e -> applyFailure(e, Flag.PERMITS) }
        }
    }

    private fun calculateDepreciation() {
        if (!_state.value.unlocked) return
        when (val parsed = CalculatorInputs.parseDepreciation(_state.value.depreciationForm)) {
            is CalculatorParseResult.Err ->
                _state.update {
                    it.copy(validation = parsed.reason, error = null, depreciation = emptyList())
                }
            is CalculatorParseResult.Ok ->
                _state.update {
                    it.copy(depreciation = parsed.value, validation = null, error = null)
                }
        }
    }

    private enum class Flag { LANDED, TCO, OWNERSHIP, PERMITS }

    private fun applyFailure(e: Throwable, flag: Flag) {
        val mapped = ErrorMapper.map(e)
        _state.update {
            it.copy(
                calculatingLanded = if (flag == Flag.LANDED) false else it.calculatingLanded,
                calculatingTco = if (flag == Flag.TCO) false else it.calculatingTco,
                calculatingOwnership = if (flag == Flag.OWNERSHIP) false else it.calculatingOwnership,
                loadingPermits = if (flag == Flag.PERMITS) false else it.loadingPermits,
                offline = mapped is AppError.Network,
                error = mapped.message,
            )
        }
    }
}
