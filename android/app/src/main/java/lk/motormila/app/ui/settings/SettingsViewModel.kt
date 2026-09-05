package lk.motormila.app.ui.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.WorkManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
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
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.FeedbackRequestDto
import lk.motormila.app.domain.repository.AuthRepository

data class SettingsUiState(
    val feedbackDraft: String = "",
    val sendingFeedback: Boolean = false,
    val feedbackSent: Boolean = false,
    val clearingCache: Boolean = false,
    val loggingOut: Boolean = false,
    val loggedOut: Boolean = false,
    val error: String? = null,
)

sealed interface SettingsUiEvent {
    data class ThemeChanged(val theme: String) : SettingsUiEvent
    data class LanguageChanged(val code: String) : SettingsUiEvent
    data class DistrictChanged(val district: String) : SettingsUiEvent
    data class SortChanged(val sort: String) : SettingsUiEvent
    data class BiometricChanged(val enabled: Boolean) : SettingsUiEvent
    data class BaseUrlChanged(val url: String) : SettingsUiEvent
    data class FeedbackChanged(val text: String) : SettingsUiEvent
    data object SendFeedback : SettingsUiEvent
    data object ClearCache : SettingsUiEvent
    data object Logout : SettingsUiEvent
    data object ConsumeLoggedOut : SettingsUiEvent
    data object DismissError : SettingsUiEvent
}

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settingsStore: SettingsStore,
    private val authRepository: AuthRepository,
    // Feedback posts straight to POST /feedback (no FeedbackRepository exists).
    private val api: MotormilaApiService,
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsUiState())
    val state: StateFlow<SettingsUiState> = _state.asStateFlow()

    val theme: StateFlow<String> = settingsStore.observe()
        .map { it.theme }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "system")

    /** Language stub: local-only until the localisation pass adds a store key. */
    private val _language = MutableStateFlow("en")
    val language: StateFlow<String> = _language.asStateFlow()

    val defaultDistrict: StateFlow<String> = settingsStore.observe()
        .map { it.district ?: "Colombo" }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "Colombo")
    val defaultSort: StateFlow<String> = settingsStore.observe()
        .map { it.sort }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "newest")
    val biometricEnabled: StateFlow<Boolean> = settingsStore.observe()
        .map { it.biometricEnabled }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)
    val baseUrl: StateFlow<String> = settingsStore.observe()
        .map { it.baseUrlOverride ?: "" }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    fun onEvent(event: SettingsUiEvent) {
        when (event) {
            is SettingsUiEvent.ThemeChanged -> launch { settingsStore.setTheme(event.theme) }
            is SettingsUiEvent.LanguageChanged -> _language.value = event.code
            is SettingsUiEvent.DistrictChanged -> launch { settingsStore.setDistrict(event.district) }
            is SettingsUiEvent.SortChanged -> launch { settingsStore.setSort(event.sort) }
            is SettingsUiEvent.BiometricChanged -> launch { settingsStore.setBiometricEnabled(event.enabled) }
            is SettingsUiEvent.BaseUrlChanged -> launch {
                settingsStore.setBaseUrlOverride(event.url.ifBlank { null })
            }
            is SettingsUiEvent.FeedbackChanged ->
                _state.update { it.copy(feedbackDraft = event.text, feedbackSent = false) }
            SettingsUiEvent.SendFeedback -> sendFeedback()
            SettingsUiEvent.ClearCache -> clearCache()
            SettingsUiEvent.Logout -> logout()
            SettingsUiEvent.ConsumeLoggedOut -> _state.update { it.copy(loggedOut = false) }
            SettingsUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch {
            runCatching { block() }
                .onFailure { e -> _state.update { it.copy(error = e.message) } }
        }
    }

    private fun sendFeedback() {
        val text = _state.value.feedbackDraft.trim()
        if (text.length < 10) {
            _state.update { it.copy(error = "Tell us a little more (10+ characters).") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(sendingFeedback = true, error = null) }
            runCatching { api.feedback(FeedbackRequestDto(message = text)) }
                .onSuccess { _state.update { it.copy(sendingFeedback = false, feedbackDraft = "", feedbackSent = true) } }
                .onFailure { e ->
                    _state.update { it.copy(sendingFeedback = false, error = e.message ?: "Couldn't send feedback.") }
                }
        }
    }

    private fun clearCache() {
        // SettingsStore has no cache-clear API; image/stats caches are Room/Coil-owned.
        // Acknowledge the tap so the UI settles (wired to Coil/Room eviction in v2).
        viewModelScope.launch {
            _state.update { it.copy(clearingCache = true) }
            _state.update { it.copy(clearingCache = false) }
        }
    }

    private fun logout() {
        viewModelScope.launch {
            _state.update { it.copy(loggingOut = true) }
            runCatching {
                // Cancel background sync/alert workers so a signed-out device goes quiet.
                WorkManager.getInstance(context).cancelAllWork()
                authRepository.logout()
            }.onSuccess {
                _state.update { it.copy(loggingOut = false, loggedOut = true) }
            }.onFailure { e ->
                _state.update { it.copy(loggingOut = false, error = e.message ?: "Couldn't log out.") }
            }
        }
    }
}
