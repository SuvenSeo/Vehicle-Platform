package lk.motormila.app.ui.compare

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.repository.ListingRepository
import lk.motormila.app.ui.navigation.Compare

data class CompareUiState(
    val ids: List<Int> = emptyList(),
    val isLoading: Boolean = true,
    val items: List<Listing> = emptyList(),
    val error: String? = null,
)

sealed interface CompareUiEvent {
    data object Refresh : CompareUiEvent
    data class Remove(val id: Int) : CompareUiEvent
    data object DismissError : CompareUiEvent
}

@HiltViewModel
class CompareViewModel @Inject constructor(
    private val repository: ListingRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val _state = MutableStateFlow(
        CompareUiState(
            // Type-safe nav passes Compare(ids: List<Int>); fall back to legacy "ids" String.
            ids = runCatching { savedStateHandle.toRoute<Compare>().ids }.getOrNull()
                ?: savedStateHandle.get<List<Int>>("ids")
                ?: savedStateHandle.get<String>("ids")
                    ?.split(",")
                    ?.mapNotNull { it.toIntOrNull() }
                .orEmpty().distinct().take(4),
        ),
    )
    val state: StateFlow<CompareUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun onEvent(event: CompareUiEvent) {
        when (event) {
            CompareUiEvent.Refresh -> load()
            is CompareUiEvent.Remove -> {
                _state.update { it.copy(ids = it.ids - event.id, items = it.items.filter { d -> d.id != event.id }) }
            }
            CompareUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    /** Screen calls this when the add-picker returns a new id (kept to max 4). */
    fun add(id: Int) {
        val ids = (_state.value.ids + id).distinct().take(4)
        _state.update { it.copy(ids = ids) }
        load()
    }

    private fun load() {
        val ids = _state.value.ids
        if (ids.isEmpty()) {
            _state.update { it.copy(isLoading = false, items = emptyList()) }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            runCatching {
                ids.map { id -> repository.getDetail(id) }
            }.onSuccess { details ->
                _state.update { it.copy(isLoading = false, items = details) }
            }.onFailure { e ->
                _state.update { it.copy(isLoading = false, error = e.message ?: "Couldn't load comparison.") }
            }
        }
    }
}
