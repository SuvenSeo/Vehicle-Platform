package lk.motormila.app.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.launch
import lk.motormila.app.domain.model.AlertInput
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.repository.AlertsRepository
import lk.motormila.app.domain.repository.ListingQuery
import lk.motormila.app.domain.repository.ListingRepository
import lk.motormila.app.domain.usecase.GetListingsPagingUseCase
import lk.motormila.app.domain.usecase.ToggleWatchlistUseCase
import javax.inject.Inject

data class SearchUiState(
    val query: String = "",
    val filters: ListingQuery = ListingQuery(),
    val suggestions: List<Listing> = emptyList(),
    val recentSearches: List<String> = emptyList(),
    val compareIds: List<Int> = emptyList(),
    val showFilterSheet: Boolean = false,
    val makes: List<String> = emptyList(),
    val districts: List<String> = emptyList(),
    val alertSaved: Boolean = false,
    val error: String? = null,
)

@OptIn(ExperimentalCoroutinesApi::class, FlowPreview::class)
@HiltViewModel
class SearchViewModel @Inject constructor(
    private val getListingsPaging: GetListingsPagingUseCase,
    private val toggleWatchlist: ToggleWatchlistUseCase,
    private val listings: ListingRepository,
    private val alerts: AlertsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private val queryFlow = MutableStateFlow("")
    private val pagingKey = MutableStateFlow(ListingQuery())

    /** Paging3 stream; re-created on query/filter/sort change, cached in VM scope. */
    val paging: Flow<PagingData<Listing>> = pagingKey
        .flatMapLatest { getListingsPaging(it) }
        .cachedIn(viewModelScope)

    init {
        viewModelScope.launch {
            try {
                _state.value = _state.value.copy(
                    makes = listings.makes(),
                    districts = listOf(
                        "Colombo", "Gampaha", "Kandy", "Galle", "Kurunegala",
                        "Jaffna", "Negombo", "Matara", "Anuradhapura", "Badulla",
                    ),
                )
            } catch (_: Exception) {
            }
        }
        // Debounced suggestions.
        viewModelScope.launch {
            queryFlow.debounce(300).distinctUntilChanged().collect { q ->
                if (q.isBlank()) {
                    _state.value = _state.value.copy(suggestions = emptyList())
                } else {
                    try {
                        _state.value = _state.value.copy(suggestions = listings.suggestions(q))
                    } catch (_: Exception) {
                    }
                }
            }
        }
    }

    fun onQueryChange(q: String) {
        queryFlow.value = q
        _state.value = _state.value.copy(query = q)
    }

    fun onSearch(q: String) {
        val trimmed = q.trim()
        if (trimmed.isNotBlank()) {
            val recents = (listOf(trimmed) + _state.value.recentSearches).distinct().take(8)
            _state.value = _state.value.copy(recentSearches = recents)
        }
        applyFilters(_state.value.filters.copy(keyword = trimmed.ifBlank { null }))
    }

    fun applyFilters(query: ListingQuery) {
        _state.value = _state.value.copy(filters = query, showFilterSheet = false, error = null)
        pagingKey.value = query
    }

    fun onSortChange(sort: String) = applyFilters(_state.value.filters.copy(sort = sort))

    fun openFilters() {
        _state.value = _state.value.copy(showFilterSheet = true)
    }

    fun closeFilters() {
        _state.value = _state.value.copy(showFilterSheet = false)
    }

    fun resetFilters() {
        applyFilters(ListingQuery(keyword = _state.value.query.ifBlank { null }))
    }

    fun toggleCompare(id: Int) {
        val current = _state.value.compareIds.toMutableList()
        if (current.contains(id)) current.remove(id)
        else if (current.size < 4) current.add(id)
        _state.value = _state.value.copy(compareIds = current)
    }

    fun clearCompare() {
        _state.value = _state.value.copy(compareIds = emptyList())
    }

    fun toggleWatch(listing: Listing) {
        viewModelScope.launch {
            try {
                toggleWatchlist(listing)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    /** Create a price alert from the current filters. */
    fun createAlertFromFilters() {
        val f = _state.value.filters
        viewModelScope.launch {
            try {
                alerts.create(
                    AlertInput(
                        make = f.make,
                        model = f.model,
                        maxPriceLkr = f.priceMax,
                        district = f.district,
                    ),
                )
                _state.value = _state.value.copy(alertSaved = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message ?: "Couldn't save alert")
            }
        }
    }

    fun consumeAlertSaved() {
        _state.value = _state.value.copy(alertSaved = false)
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}
