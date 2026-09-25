package lk.motormila.app.ui.pulse

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.domain.model.MarketSignal
import lk.motormila.app.domain.repository.StatsRepository
import lk.motormila.app.ui.navigation.OfficialPulseDetail

data class OfficialPulseDetailUiState(
    val isLoading: Boolean = true,
    val signal: MarketSignal? = null,
    val error: String? = null,
)

@HiltViewModel
class OfficialPulseDetailViewModel @Inject constructor(
    private val stats: StatsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val signalId = savedStateHandle.toRoute<OfficialPulseDetail>().id

    private val _state = MutableStateFlow(OfficialPulseDetailUiState())
    val state: StateFlow<OfficialPulseDetailUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = OfficialPulseDetailUiState(isLoading = true)
            if (signalId <= 0) {
                _state.value = OfficialPulseDetailUiState(
                    isLoading = false,
                    error = "That signal ID is not valid.",
                )
                return@launch
            }
            runCatching { stats.marketSignal(signalId) }
                .onSuccess { signal ->
                    _state.value = OfficialPulseDetailUiState(isLoading = false, signal = signal)
                }
                .onFailure { error ->
                    _state.value = OfficialPulseDetailUiState(
                        isLoading = false,
                        error = ErrorMapper.map(error).message,
                    )
                }
        }
    }
}
