package lk.motormila.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.core.common.AppError
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.data.local.datastore.SettingsStore
import lk.motormila.app.domain.repository.AuthRepository
import lk.motormila.app.domain.usecase.LoginUseCase
import lk.motormila.app.domain.usecase.ObserveSessionUseCase

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val inviteToken: String = "",
    val isSignupTab: Boolean = false,
    val loading: Boolean = false,
    /** Increments on each failed attempt to retrigger the shake animation. */
    val shakeToken: Int = 0,
    val error: String? = null,
    /** True when the last failure was transport-level (drives the offline badge). */
    val offline: Boolean = false,
    val loggedIn: Boolean = false,
    val biometricAvailable: Boolean = false,
    /** True until the cold-start restore() finishes ( SplashGate also gates on this). */
    val restoring: Boolean = true,
    /** Last known session (drives biometric fast-path + "signed in as" hint). */
    val sessionEmail: String? = null,
    val expiresAt: String? = null,
    val sessionExpired: Boolean = false,
)

sealed interface AuthUiEvent {
    data class EmailChanged(val value: String) : AuthUiEvent
    data class PasswordChanged(val value: String) : AuthUiEvent
    data class InviteTokenChanged(val value: String) : AuthUiEvent
    data class TabChanged(val signup: Boolean) : AuthUiEvent
    data object Submit : AuthUiEvent
    data object Retry : AuthUiEvent
    data object BiometricUnlock : AuthUiEvent
    /** Biometric prompt succeeded: fast-path when a live session exists, else submit. */
    data object BiometricSuccess : AuthUiEvent
    data object ConsumeLoggedIn : AuthUiEvent
    data object DismissError : AuthUiEvent
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val login: LoginUseCase,
    observeSession: ObserveSessionUseCase,
    settingsStore: SettingsStore,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    val biometricEnabled: StateFlow<Boolean> = settingsStore.observe()
        .map { it.biometricEnabled }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    init {
        // Re-hydrate the interceptor token after process death so the first
        // post-restart request already carries auth (foundation 401 -> Login
        // is still the backstop via AuthEventBus in the nav graph).
        viewModelScope.launch {
            runCatching { authRepository.restore() }
            _state.update { it.copy(restoring = false) }
        }
        viewModelScope.launch {
            observeSession().collect { session ->
                val expired = session?.expiresAt?.let { iso ->
                    runCatching { Instant.parse(iso).isBefore(Instant.now()) }.getOrDefault(false)
                } == true
                _state.update {
                    it.copy(
                        sessionEmail = session?.email,
                        expiresAt = session?.expiresAt,
                        sessionExpired = expired,
                    )
                }
            }
        }
    }

    fun onEvent(event: AuthUiEvent) {
        when (event) {
            is AuthUiEvent.EmailChanged -> _state.update { it.copy(email = event.value, error = null, offline = false) }
            is AuthUiEvent.PasswordChanged -> _state.update { it.copy(password = event.value, error = null, offline = false) }
            is AuthUiEvent.InviteTokenChanged -> _state.update { it.copy(inviteToken = event.value, error = null, offline = false) }
            is AuthUiEvent.TabChanged -> _state.update { it.copy(isSignupTab = event.signup, error = null, offline = false) }
            AuthUiEvent.Submit -> submit()
            AuthUiEvent.Retry -> submit()
            AuthUiEvent.BiometricUnlock -> _state.update { it.copy(biometricAvailable = true) }
            AuthUiEvent.BiometricSuccess -> onBiometricSuccess()
            AuthUiEvent.ConsumeLoggedIn -> _state.update { it.copy(loggedIn = false) }
            AuthUiEvent.DismissError -> _state.update { it.copy(error = null, offline = false) }
        }
    }

    private fun onBiometricSuccess() {
        val s = _state.value
        // Live session on file: skip credential round-trip entirely.
        if (s.sessionEmail != null && !s.sessionExpired) {
            _state.update { it.copy(loggedIn = true, error = null, offline = false) }
        } else {
            submit()
        }
    }

    private fun submit() {
        val s = _state.value
        if (s.email.isBlank() || s.password.isBlank()) {
            // Biometric fast-path already handled above; here credentials are required.
            fail(AppError.Validation("Enter your email and password."))
            return
        }
        if (s.isSignupTab && s.inviteToken.isBlank()) {
            fail(AppError.Validation("Invite token is required — Motormila access is invite-only."))
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, offline = false) }
            // Signup has no use-case wrapper yet (see follow-ups); login goes via LoginUseCase.
            runCatching {
                if (s.isSignupTab) {
                    authRepository.signup(
                        name = s.email.trim().substringBefore("@").ifBlank { "Driver" },
                        email = s.email.trim(),
                        password = s.password,
                        inviteToken = s.inviteToken.trim().ifBlank { null },
                    )
                } else {
                    login(s.email.trim(), s.password)
                }
            }.onSuccess { _state.update { it.copy(loading = false, loggedIn = true) } }
                .onFailure { e -> fail(ErrorMapper.map(e)) }
        }
    }

    private fun fail(error: AppError) {
        _state.update {
            it.copy(
                loading = false,
                error = error.message,
                offline = error is AppError.Network,
                shakeToken = it.shakeToken + 1,
            )
        }
    }
}
