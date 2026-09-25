package lk.motormila.app.ui.insights

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
import lk.motormila.app.domain.model.PriceIndex
import lk.motormila.app.domain.repository.InsightsRepository

data class PriceIndexUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val index: PriceIndex = PriceIndex(),
)

@HiltViewModel
class PriceIndexViewModel @Inject constructor(
    private val repository: InsightsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(PriceIndexUiState())
    val state: StateFlow<PriceIndexUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            runCatching { repository.index() }
                .onSuccess { index ->
                    _state.update { it.copy(isLoading = false, index = index, error = null) }
                }
                .onFailure { error ->
                    val mapped = ErrorMapper.map(error)
                    _state.update {
                        it.copy(isLoading = false, error = mapped.message)
                    }
                }
        }
    }
}
