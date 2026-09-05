package lk.motormila.app.ui.alerts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.core.format.parseLkrShorthand
import lk.motormila.app.domain.model.Alert
import lk.motormila.app.domain.model.AlertInput
import lk.motormila.app.domain.model.AlertMatch
import lk.motormila.app.domain.repository.AlertsRepository
import lk.motormila.app.domain.repository.AuthRepository

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
    val creating: Boolean = false,
    /** Confetti-lite burst token: non-null right after a successful create. */
    val justCreatedId: Int? = null,
    val alerts: List<Alert> = emptyList(),
    /** Per-alert match groups; empty until match(id) previews are wired per row. */
    val matches: List<AlertMatch> = emptyList(),
    val isPro: Boolean = false,
    /** Free plan cap: 1 active alert. */
    val freeCapReached: Boolean = false,
    val error: String? = null,
)

sealed interface AlertsUiEvent {
    data object Refresh : AlertsUiEvent
    data class FormChanged(val form: AlertForm) : AlertsUiEvent
    data object Create : AlertsUiEvent
    data class Delete(val id: Int) : AlertsUiEvent
    data object ConsumeCreated : AlertsUiEvent
    data object DismissError : AlertsUiEvent
}

@HiltViewModel
class AlertsViewModel @Inject constructor(
    private val repository: AlertsRepository,
    authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AlertsUiState())
    val state: StateFlow<AlertsUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            // AlertsRepository has no observeMatches; matches stay empty (rows show
            // alert config only) until per-alert match(id) previews are wired.
            combine(
                repository.observeAlerts(),
                authRepository.session(),
            ) { alerts, session ->
                Triple(alerts, emptyList<AlertMatch>(), session?.isPro == true)
            }.catch { e ->
                _state.update { it.copy(isLoading = false, isRefreshing = false, error = e.message) }
            }.collect { (alerts, matches, isPro) ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        alerts = alerts,
                        matches = matches,
                        isPro = isPro,
                        freeCapReached = !isPro && alerts.size >= 1,
                    )
                }
            }
        }
    }

    fun onEvent(event: AlertsUiEvent) {
        when (event) {
            AlertsUiEvent.Refresh -> refresh()
            is AlertsUiEvent.FormChanged -> _state.update { it.copy(form = event.form) }
            AlertsUiEvent.Create -> create()
            is AlertsUiEvent.Delete -> delete(event.id)
            AlertsUiEvent.ConsumeCreated -> _state.update { it.copy(justCreatedId = null) }
            AlertsUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, error = null) }
            runCatching { repository.refresh() }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Couldn't refresh alerts.") } }
            _state.update { it.copy(isRefreshing = false) }
        }
    }

    private fun create() {
        val f = _state.value.form
        if (_state.value.freeCapReached) {
            _state.update { it.copy(error = "Free plan allows 1 alert. Upgrade to Pro for unlimited alerts.") }
            return
        }
        val maxPrice = parseLkrShorthand(f.maxPrice)
        if (f.make.isBlank() || maxPrice == null) {
            _state.update { it.copy(error = "Enter at least a make and a max price (e.g. 8m).") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(creating = true, error = null) }
            // AlertInput has no channels list; push/email toggles fold into notifyChannels CSV.
            runCatching {
                repository.create(
                    AlertInput(
                        make = f.make.trim(),
                        model = f.model.trim().ifBlank { null },
                        district = f.district,
                        maxPriceLkr = maxPrice,
                        notifyChannels = buildList {
                            if (f.push) add("push")
                            if (f.email) add("email")
                        }.ifEmpty { listOf("push") }.joinToString(","),
                    ),
                )
            }.onSuccess { alert ->
                _state.update { it.copy(creating = false, form = AlertForm(), justCreatedId = alert.id) }
            }.onFailure { e ->
                _state.update { it.copy(creating = false, error = e.message ?: "Couldn't create alert.") }
            }
        }
    }

    private fun delete(id: Int) {
        viewModelScope.launch {
            runCatching { repository.delete(id) }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Couldn't delete alert.") } }
        }
    }
}
