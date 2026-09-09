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
import lk.motormila.app.domain.repository.Tco
import lk.motormila.app.domain.repository.ValuationRepository
import lk.motormila.app.domain.usecase.ObserveSessionUseCase

data class CalculatorUiState(
    val unlocked: Boolean = false,
    val tab: CalculatorTab = CalculatorTab.LANDED,
    val landedForm: LandedForm = LandedForm(),
    val tcoForm: TcoForm = TcoForm(),
    val landed: LandedCost? = null,
    val tco: Tco? = null,
    val calculatingLanded: Boolean = false,
    val calculatingTco: Boolean = false,
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
            is CalculatorUiEvent.TabSelected ->
                _state.update { it.copy(tab = event.tab, validation = null) }
            is CalculatorUiEvent.LandedFormChanged ->
                _state.update { it.copy(landedForm = event.form, validation = null) }
            CalculatorUiEvent.CalculateLanded -> calculateLanded()
            is CalculatorUiEvent.TcoFormChanged ->
                _state.update { it.copy(tcoForm = event.form, validation = null) }
            CalculatorUiEvent.CalculateTco -> calculateTco()
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
                    .onFailure { e -> applyFailure(e, landed = true) }
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
                    .onFailure { e -> applyFailure(e, landed = false) }
            }
        }
    }

    private fun applyFailure(e: Throwable, landed: Boolean) {
        val mapped = ErrorMapper.map(e)
        _state.update {
            it.copy(
                calculatingLanded = if (landed) false else it.calculatingLanded,
                calculatingTco = if (!landed) false else it.calculatingTco,
                offline = mapped is AppError.Network,
                error = mapped.message,
            )
        }
    }
}
