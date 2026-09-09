package lk.motormila.app.ui.alerts

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlin.math.abs
import kotlin.math.round
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.core.common.AppError
import lk.motormila.app.core.format.parseLkrShorthand
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.domain.model.Alert
import lk.motormila.app.domain.model.AlertInput
import lk.motormila.app.domain.model.AlertMatch
import lk.motormila.app.domain.repository.AlertsRepository
import lk.motormila.app.domain.repository.AuthRepository
import lk.motormila.app.domain.repository.ListingRepository
import lk.motormila.app.ui.navigation.Alerts

/**
 * Format rupees as alert-form shorthand: "8.5m" at/above 1M, else a whole-rupee integer.
 * Inverse of [parseLkrShorthand] for the common million case.
 */
fun formatLkrShorthand(value: Double): String {
    if (value >= 1_000_000) {
        val millions = value / 1_000_000.0
        val rounded = round(millions * 100.0) / 100.0
        val whole = rounded.toLong()
        val text = if (abs(rounded - whole) < 1e-9) {
            whole.toString()
        } else {
            rounded.toString().trimEnd('0').trimEnd('.')
        }
        return "${text}m"
    }
    return value.toLong().toString()
}

data class AlertForm(
    val make: String = "",
    val model: String = "",
    val district: String = "Colombo",
    val maxPrice: String = "",
    val push: Boolean = true,
    val email: Boolean = false,
)

data class AlertsUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val form: AlertForm = AlertForm(),
    /** Alert id currently loaded into the form for editing (null = creating). */
    val editingId: Int? = null,
    val creating: Boolean = false,
    val updating: Boolean = false,
    /** Confetti-lite burst token: non-null right after a successful create. */
    val justCreatedId: Int? = null,
    val alerts: List<Alert> = emptyList(),
    /** Per-alert match groups (match-all + filter workaround, first 5 alerts). */
    val matches: List<AlertMatch> = emptyList(),
    val matchesLoading: Boolean = false,
    /** Row ids with an in-flight active-toggle. */
    val togglingIds: Set<Int> = emptySet(),
    val isPro: Boolean = false,
    /** Free plan cap: 1 active alert. */
    val freeCapReached: Boolean = false,
    /** Inbox unread count (same repository's notification surface). */
    val unreadCount: Int = 0,
    val offline: Boolean = false,
    val error: String? = null,
    /**
     * Watchlist → Alerts listing-id prefill is in flight or finished.
     * Keeps the create form visible when listing detail fails (error goes to snackbar).
     */
    val prefillFromListing: Boolean = false,
    /** One-shot: form was just filled from a listing; screen shows a snackbar then consumes. */
    val justPrefill: Boolean = false,
)

sealed interface AlertsUiEvent {
    data object Refresh : AlertsUiEvent
    data class FormChanged(val form: AlertForm) : AlertsUiEvent
    data object Create : AlertsUiEvent
    data class Prefill(val id: Int) : AlertsUiEvent
    data object CancelEdit : AlertsUiEvent
    data object Update : AlertsUiEvent
    data class ToggleActive(val id: Int, val active: Boolean) : AlertsUiEvent
    data object RefreshMatches : AlertsUiEvent
    data class Delete(val id: Int) : AlertsUiEvent
    data object ConsumeCreated : AlertsUiEvent
    data object ConsumePrefill : AlertsUiEvent
    data object DismissError : AlertsUiEvent
}

@HiltViewModel
class AlertsViewModel @Inject constructor(
    private val repository: AlertsRepository,
    private val listings: ListingRepository,
    authRepository: AuthRepository,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val _state = MutableStateFlow(AlertsUiState())
    val state: StateFlow<AlertsUiState> = _state.asStateFlow()

    private var lastMatchedIds: List<Int> = emptyList()

    init {
        viewModelScope.launch {
            combine(
                repository.observeAlerts(),
                authRepository.session(),
            ) { alerts, session ->
                Triple(alerts, session?.isPro == true, alerts.map { it.id })
            }.catch { e ->
                val mapped = ErrorMapper.map(e)
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        offline = mapped is AppError.Network,
                        error = mapped.message,
                    )
                }
            }.collect { (alerts, isPro, ids) ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        offline = false,
                        alerts = alerts,
                        isPro = isPro,
                        freeCapReached = !isPro && alerts.size >= 1,
                    )
                }
                // Match-all + filter previews, reloaded only when the id set changes.
                if (ids != lastMatchedIds) {
                    lastMatchedIds = ids
                    loadMatches(alerts)
                }
            }
        }
        viewModelScope.launch {
            repository.unreadCount()
                .catch { emit(0) }
                .collect { n -> _state.update { it.copy(unreadCount = n) } }
        }
        prefillFromListingIfNeeded()
    }

    fun onEvent(event: AlertsUiEvent) {
        when (event) {
            AlertsUiEvent.Refresh -> refresh()
            is AlertsUiEvent.FormChanged -> _state.update { it.copy(form = event.form) }
            AlertsUiEvent.Create -> create()
            is AlertsUiEvent.Prefill -> prefill(event.id)
            AlertsUiEvent.CancelEdit -> _state.update { it.copy(editingId = null, form = AlertForm()) }
            AlertsUiEvent.Update -> update()
            is AlertsUiEvent.ToggleActive -> toggleActive(event.id, event.active)
            AlertsUiEvent.RefreshMatches -> loadMatches(_state.value.alerts, force = true)
            is AlertsUiEvent.Delete -> delete(event.id)
            AlertsUiEvent.ConsumeCreated -> _state.update { it.copy(justCreatedId = null) }
            AlertsUiEvent.ConsumePrefill -> _state.update { it.copy(justPrefill = false) }
            AlertsUiEvent.DismissError -> _state.update { it.copy(error = null, offline = false) }
        }
    }

    /**
     * Watchlist "create alert" navigates with [Alerts.listingId] > 0. WatchItem has no
     * make/model, so we load listing detail and copy make/model/district/max price into the form.
     */
    private fun prefillFromListingIfNeeded() {
        if (savedStateHandle.get<Boolean>(PREFILL_CONSUMED_KEY) == true) return
        val listingId = runCatching { savedStateHandle.toRoute<Alerts>() }.getOrNull()?.listingId ?: return
        if (listingId <= 0) return
        _state.update { it.copy(prefillFromListing = true) }
        viewModelScope.launch {
            runCatching { listings.getDetail(listingId) }
                .onSuccess { listing ->
                    savedStateHandle[PREFILL_CONSUMED_KEY] = true
                    _state.update { current ->
                        current.copy(
                            form = current.form.copy(
                                make = listing.make,
                                model = listing.model,
                                district = listing.district ?: "Colombo",
                                maxPrice = listing.priceLkr?.let(::formatLkrShorthand).orEmpty(),
                            ),
                            justPrefill = true,
                        )
                    }
                }
                .onFailure { e ->
                    val mapped = ErrorMapper.map(e)
                    _state.update {
                        it.copy(
                            offline = mapped is AppError.Network,
                            error = mapped.message,
                        )
                    }
                }
        }
    }

    private fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, error = null, offline = false) }
            runCatching { repository.refresh() }
                .onFailure { e ->
                    val mapped = ErrorMapper.map(e)
                    _state.update {
                        it.copy(offline = mapped is AppError.Network, error = mapped.message)
                    }
                }
            _state.update { it.copy(isRefreshing = false) }
        }
    }

    /** Match-all + client-side filter (DATA_CONTRACT §2); bounded to 5 alerts. */
    private fun loadMatches(alerts: List<Alert>, force: Boolean = false) {
        if (alerts.isEmpty()) {
            _state.update { it.copy(matches = emptyList(), matchesLoading = false) }
            return
        }
        if (_state.value.matchesLoading && !force) return
        viewModelScope.launch {
            _state.update { it.copy(matchesLoading = true) }
            val groups = alerts.take(5).mapNotNull { alert ->
                runCatching { repository.match(alert.id, limit = 5) }.getOrNull()
            }
            _state.update { it.copy(matches = groups, matchesLoading = false) }
        }
    }

    private fun buildInput(f: AlertForm): AlertInput? {
        val maxPrice = parseLkrShorthand(f.maxPrice)
        if (f.make.isBlank() || maxPrice == null) return null
        return AlertInput(
            make = f.make.trim(),
            model = f.model.trim().ifBlank { null },
            district = f.district,
            maxPriceLkr = maxPrice,
            notifyChannels = buildList {
                if (f.push) add("push")
                if (f.email) add("email")
            }.ifEmpty { listOf("push") }.joinToString(","),
        )
    }

    private fun create() {
        val f = _state.value.form
        if (_state.value.freeCapReached) {
            _state.update { it.copy(error = "Free plan allows 1 alert. Upgrade to Pro for unlimited alerts.") }
            return
        }
        // AlertInput has no channels list; push/email toggles fold into notifyChannels CSV.
        val input = buildInput(f)
        if (input == null) {
            _state.update { it.copy(error = "Enter at least a make and a max price (e.g. 8m).") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(creating = true, error = null, offline = false) }
            runCatching { repository.create(input) }
                .onSuccess { alert ->
                    _state.update { it.copy(creating = false, form = AlertForm(), justCreatedId = alert.id) }
                }
                .onFailure { e ->
                    val mapped = ErrorMapper.map(e)
                    _state.update {
                        it.copy(
                            creating = false,
                            offline = mapped is AppError.Network,
                            error = mapped.message,
                        )
                    }
                }
        }
    }

    private fun prefill(id: Int) {
        val alert = _state.value.alerts.firstOrNull { it.id == id } ?: return
        _state.update {
            it.copy(
                editingId = id,
                form = AlertForm(
                    make = alert.make.orEmpty(),
                    model = alert.model.orEmpty(),
                    district = alert.district ?: "Colombo",
                    maxPrice = alert.maxPriceLkr?.let(::formatLkrShorthand).orEmpty(),
                    push = alert.notifyChannels?.contains("push") != false,
                    email = alert.notifyChannels?.contains("email") == true,
                ),
            )
        }
    }

    /** Update workaround (DATA_CONTRACT §2): delete + create on the backend. */
    private fun update() {
        val id = _state.value.editingId ?: return
        val input = buildInput(_state.value.form)
        if (input == null) {
            _state.update { it.copy(error = "Enter at least a make and a max price (e.g. 8m).") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(updating = true, error = null, offline = false) }
            runCatching { repository.update(id, input) }
                .onSuccess { alert ->
                    lastMatchedIds = emptyList() // force match reload (new id after delete+create)
                    _state.update {
                        it.copy(updating = false, editingId = null, form = AlertForm(), justCreatedId = alert.id)
                    }
                }
                .onFailure { e ->
                    val mapped = ErrorMapper.map(e)
                    _state.update {
                        it.copy(
                            updating = false,
                            offline = mapped is AppError.Network,
                            error = mapped.message,
                        )
                    }
                }
        }
    }

    /** setActive workaround (DATA_CONTRACT §2): local Room toggle, reconciled on refresh. */
    private fun toggleActive(id: Int, active: Boolean) {
        viewModelScope.launch {
            _state.update { it.copy(togglingIds = it.togglingIds + id) }
            runCatching { repository.setActive(id, active) }
                .onSuccess { runCatching { repository.refresh() } }
                .onFailure { e ->
                    val mapped = ErrorMapper.map(e)
                    _state.update {
                        it.copy(offline = mapped is AppError.Network, error = mapped.message)
                    }
                }
            _state.update { it.copy(togglingIds = it.togglingIds - id) }
        }
    }

    private fun delete(id: Int) {
        viewModelScope.launch {
            runCatching { repository.delete(id) }
                .onFailure { e ->
                    val mapped = ErrorMapper.map(e)
                    _state.update {
                        it.copy(offline = mapped is AppError.Network, error = mapped.message)
                    }
                }
        }
    }

    companion object {
        private const val PREFILL_CONSUMED_KEY = "alerts_prefill_consumed"
    }
}
