package lk.motormila.app.ui.profile

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
import lk.motormila.app.core.common.AppError
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.domain.repository.AlertsRepository
import lk.motormila.app.domain.repository.AuthRepository
import lk.motormila.app.domain.repository.WatchlistRepository

/** UI-local profile row (no ProfileRepository/UserProfile exists in domain). */
data class UiBadge(val label: String, val earned: Boolean)

data class UiProfile(
    val displayName: String,
    val email: String,
    val planName: String,
    val isPro: Boolean,
    val role: String,
    val isAdmin: Boolean,
    /** "Signed in" vs "Guest" — drives the session-state row. */
    val sessionState: String,
    val expiresAt: String?,
    val watchlistCount: Int,
    val alertCount: Int,
    val dealHunterScore: Int,
    val streakDays: Int,
    val badges: List<UiBadge>,
    val loggedIn: Boolean,
)

data class ProfileUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val profile: UiProfile? = null,
    val offline: Boolean = false,
    val error: String? = null,
)

sealed interface ProfileUiEvent {
    data object Refresh : ProfileUiEvent
    data object DismissError : ProfileUiEvent
}

@HiltViewModel
class ProfileViewModel @Inject constructor(
    authRepository: AuthRepository,
    alertsRepository: AlertsRepository,
    watchlistRepository: WatchlistRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            combine(
                authRepository.session(),
                alertsRepository.observeAlerts(),
                watchlistRepository.observe(),
            ) { session, alerts, watched ->
                val loggedIn = session != null
                val plan = session?.plan?.ifBlank { null } ?: "free"
                val planName = plan.replaceFirstChar { c -> c.uppercase() }
                val isPro = session?.isPro == true
                val isAdmin = session?.isAdmin == true
                val watchCount = watched.size
                val alertCount = alerts.size
                // Deterministic local gamification until a profile endpoint lands.
                val score = ((watchCount * 12 + alertCount * 18).coerceAtMost(100))
                UiProfile(
                    displayName = session?.name?.ifBlank { null }
                        ?: session?.email?.substringBefore("@") ?: "Guest",
                    email = session?.email ?: "Not signed in",
                    planName = planName,
                    isPro = isPro,
                    role = session?.role?.ifBlank { null } ?: "user",
                    isAdmin = isAdmin,
                    sessionState = if (loggedIn) "Signed in" else "Guest",
                    expiresAt = session?.expiresAt,
                    watchlistCount = watchCount,
                    alertCount = alertCount,
                    dealHunterScore = score,
                    streakDays = if (watchCount > 0) (watchCount % 30) + 1 else 0,
                    badges = listOf(
                        UiBadge("First watch", watchCount >= 1),
                        UiBadge("Alert setter", alertCount >= 1),
                        UiBadge("Pro member", isPro),
                        UiBadge("Deal hunter", score >= 50),
                    ),
                    loggedIn = loggedIn,
                )
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
            }.collect { profile ->
                _state.update { it.copy(isLoading = false, isRefreshing = false, offline = false, profile = profile) }
            }
        }
    }

    fun onEvent(event: ProfileUiEvent) {
        when (event) {
            // Flows are hot and re-emit on their own; nothing to reload — just settle the spinner.
            ProfileUiEvent.Refresh -> _state.update { it.copy(isRefreshing = false, offline = false, error = null) }
            ProfileUiEvent.DismissError -> _state.update { it.copy(error = null, offline = false) }
        }
    }
}
