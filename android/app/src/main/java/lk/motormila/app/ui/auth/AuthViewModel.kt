package lk.motormila.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.data.local.datastore.SettingsStore
import lk.motormila.app.domain.repository.AuthRepository

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val inviteToken: String = "",
    val isSignupTab: Boolean = false,
    val loading: Boolean = false,
    /** Increments on each failed attempt to retrigger the shake animation. */
    val shakeToken: Int = 0,
    val error: String? = null,
    val loggedIn: Boolean = false,
    val biometricAvailable: Boolean = false,
)

sealed interface AuthUiEvent {
    data class EmailChanged(val value: String) : AuthUiEvent
    data class PasswordChanged(val value: String) : AuthUiEvent
    data class InviteTokenChanged(val value: String) : AuthUiEvent
    data class TabChanged(val signup: Boolean) : AuthUiEvent
    data object Submit : AuthUiEvent
    data object BiometricUnlock : AuthUiEvent
    data object ConsumeLoggedIn : AuthUiEvent
    data object DismissError : AuthUiEvent
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    settingsStore: SettingsStore,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    val biometricEnabled: StateFlow<Boolean> = settingsStore.observe()
        .map { it.biometricEnabled }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    fun onEvent(event: AuthUiEvent) {
        when (event) {
            is AuthUiEvent.EmailChanged -> _state.update { it.copy(email = event.value, error = null) }
            is AuthUiEvent.PasswordChanged -> _state.update { it.copy(password = event.value, error = null) }
            is AuthUiEvent.InviteTokenChanged -> _state.update { it.copy(inviteToken = event.value, error = null) }
            is AuthUiEvent.TabChanged -> _state.update { it.copy(isSignupTab = event.signup, error = null) }
            AuthUiEvent.Submit -> submit()
            AuthUiEvent.BiometricUnlock -> _state.update { it.copy(biometricAvailable = true) }
            AuthUiEvent.ConsumeLoggedIn -> _state.update { it.copy(loggedIn = false) }
            AuthUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun submit() {
        val s = _state.value
        if (s.email.isBlank() || s.password.isBlank()) {
            fail("Enter your email and password.")
            return
        }
        if (s.isSignupTab && s.inviteToken.isBlank()) {
            fail("Invite token is required — Motormila access is invite-only.")
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            // AuthRepository suspends return UserSession directly (no Result wrapper).
            runCatching {
                if (s.isSignupTab) {
                    authRepository.signup(
                        name = s.email.trim().substringBefore("@").ifBlank { "Driver" },
                        email = s.email.trim(),
                        password = s.password,
                        inviteToken = s.inviteToken.trim().ifBlank { null },
                    )
                } else {
                    authRepository.login(s.email.trim(), s.password)
                }
            }.onSuccess { _state.update { it.copy(loading = false, loggedIn = true) } }
                .onFailure { e -> fail(e.message ?: "Authentication failed.") }
        }
    }

    private fun fail(message: String) {
        _state.update { it.copy(loading = false, error = message, shakeToken = it.shakeToken + 1) }
    }
}
