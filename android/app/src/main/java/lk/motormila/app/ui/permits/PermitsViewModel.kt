package lk.motormila.app.ui.permits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.domain.model.Permit
import lk.motormila.app.domain.repository.InsightsRepository

data class PermitsUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val permits: List<Permit> = emptyList(),
    val error: String? = null,
)

sealed interface PermitsUiEvent {
    data object Refresh : PermitsUiEvent
    data object DismissError : PermitsUiEvent
}

@HiltViewModel
class PermitsViewModel @Inject constructor(
    private val insights: InsightsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(PermitsUiState())
    val state: StateFlow<PermitsUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun onEvent(event: PermitsUiEvent) {
        when (event) {
            PermitsUiEvent.Refresh -> load(refreshing = true)
            PermitsUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun load(refreshing: Boolean = false) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = !refreshing, isRefreshing = refreshing, error = null) }
            runCatching { insights.permits() }
                .onSuccess { rows ->
                    _state.update {
                        it.copy(isLoading = false, isRefreshing = false, permits = rows, error = null)
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            error = ErrorMapper.map(error).message,
                        )
                    }
                }
        }
    }
}
