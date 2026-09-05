package lk.motormila.app.ui.notifications

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
import lk.motormila.app.domain.model.AppNotification
import lk.motormila.app.domain.repository.AlertsRepository

data class NotificationsUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val items: List<AppNotification> = emptyList(),
    val unreadCount: Int = 0,
    val error: String? = null,
)

sealed interface NotificationsUiEvent {
    data object Refresh : NotificationsUiEvent
    data class MarkRead(val id: String) : NotificationsUiEvent
    data object MarkAllRead : NotificationsUiEvent
    data object DismissError : NotificationsUiEvent
}

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    // Inbox rows are served by AlertsRepository (no NotificationsRepository exists).
    private val repository: AlertsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.observeNotifications()
                .catch { e ->
                    _state.update { it.copy(isLoading = false, isRefreshing = false, error = e.message) }
                }
                .collect { items ->
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            items = items,
                            unreadCount = items.count { n -> !n.isRead },
                        )
                    }
                }
        }
    }

    fun onEvent(event: NotificationsUiEvent) {
        when (event) {
            NotificationsUiEvent.Refresh -> refresh()
            is NotificationsUiEvent.MarkRead -> viewModelScope.launch {
                // Screen/NavGraph carry ids as String; domain ids are Int.
                val id = event.id.toIntOrNull()
                if (id == null) {
                    _state.update { it.copy(error = "Couldn't open that notification.") }
                    return@launch
                }
                runCatching { repository.markNotificationRead(id) }
                    .onFailure { e -> _state.update { it.copy(error = e.message) } }
            }
            NotificationsUiEvent.MarkAllRead -> viewModelScope.launch {
                // No mark-all endpoint on the repository; mark unread rows one by one.
                runCatching {
                    repository.notifications().filter { !it.isRead }
                        .forEach { repository.markNotificationRead(it.id) }
                }.onFailure { e -> _state.update { it.copy(error = e.message) } }
            }
            NotificationsUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(isRefreshing = true, error = null) }
            // observeNotifications() re-emits from network; warm it here so pull-to-refresh settles.
            runCatching { repository.notifications() }
                .onFailure { e -> _state.update { it.copy(error = e.message) } }
            _state.update { it.copy(isRefreshing = false) }
        }
    }
}
