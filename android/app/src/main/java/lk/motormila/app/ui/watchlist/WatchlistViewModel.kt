package lk.motormila.app.ui.watchlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.domain.model.WatchItem
import lk.motormila.app.domain.repository.WatchlistRepository

data class WatchlistUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val items: List<WatchItem> = emptyList(),
    /** Ids whose price dropped since previous snapshot — flash these rows. */
    val droppedIds: Set<Int> = emptySet(),
    val error: String? = null,
)

sealed interface WatchlistUiEvent {
    data object Refresh : WatchlistUiEvent
    data class Remove(val id: Int) : WatchlistUiEvent
    data object DismissError : WatchlistUiEvent
}

@HiltViewModel
class WatchlistViewModel @Inject constructor(
    private val repository: WatchlistRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(WatchlistUiState())
    val state: StateFlow<WatchlistUiState> = _state.asStateFlow()

    init {
        observe()
    }

    fun onEvent(event: WatchlistUiEvent) {
        when (event) {
            WatchlistUiEvent.Refresh -> observe(refresh = true)
            is WatchlistUiEvent.Remove -> remove(event.id)
            WatchlistUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun observe(refresh: Boolean = false) {
        viewModelScope.launch {
            if (refresh) _state.update { it.copy(isRefreshing = true, error = null) }
            repository.observeWatchlist()
                .catch { e ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            error = e.message ?: "Couldn't load your watchlist.",
                        )
                    }
                }
                .collect { items ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            items = items,
                            droppedIds = items
                                .filter { w ->
                                    val prev = w.previousPriceLkr
                                    val cur = w.priceLkr
                                    prev != null && cur != null && cur < prev
                                }
                                .map { w -> w.id }
                                .toSet(),
                        )
                    }
                }
        }
    }

    private fun remove(id: Int) {
        viewModelScope.launch {
            runCatching { repository.removeFromWatchlist(id) }
                .onFailure { e ->
                    _state.update { it.copy(error = e.message ?: "Couldn't remove that listing.") }
                }
        }
    }
}
