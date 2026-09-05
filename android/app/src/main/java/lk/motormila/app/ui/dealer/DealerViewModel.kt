package lk.motormila.app.ui.dealer

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.domain.model.DealerBenchmark
import lk.motormila.app.domain.repository.DealerRepository

private val Context.dealerStore by preferencesDataStore("dealer_claim")
private val ClaimTokenKey = stringPreferencesKey("claim_token")
private val ClaimNameKey = stringPreferencesKey("claim_display_name")
private val ClaimPhoneKey = stringPreferencesKey("claim_phone")
private val ClaimEmailKey = stringPreferencesKey("claim_email")

data class DealerClaimForm(
    val displayName: String = "",
    val phone: String = "",
    val email: String = "",
    val pattern: String = "",
    val url: String = "",
)

data class DealerUiState(
    val form: DealerClaimForm = DealerClaimForm(),
    val claiming: Boolean = false,
    /** Persisted claim token (DataStore). Null = not claimed yet. */
    val claimToken: String? = null,
    val claimedName: String = "",
    val benchmarkUrls: String = "",
    val benchmarking: Boolean = false,
    val benchmark: DealerBenchmark? = null,
    val error: String? = null,
)

sealed interface DealerUiEvent {
    data class FormChanged(val form: DealerClaimForm) : DealerUiEvent
    data object Claim : DealerUiEvent
    data class BenchmarkUrlsChanged(val urls: String) : DealerUiEvent
    data object RunBenchmark : DealerUiEvent
    data object SignOut : DealerUiEvent
    data object DismissError : DealerUiEvent
}

/**
 * Dealer claim flow. claim_token is persisted in a dedicated DataStore file
 * (`dealer_claim`) owned by this screen; the data builder may migrate it into
 * the central store later without changing this screen's API.
 */
@HiltViewModel
class DealerViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: DealerRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DealerUiState())
    val state: StateFlow<DealerUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val prefs = context.dealerStore.data.first()
            _state.update {
                it.copy(
                    claimToken = prefs[ClaimTokenKey],
                    claimedName = prefs[ClaimNameKey].orEmpty(),
                    form = it.form.copy(
                        displayName = prefs[ClaimNameKey].orEmpty(),
                        phone = prefs[ClaimPhoneKey].orEmpty(),
                        email = prefs[ClaimEmailKey].orEmpty(),
                    ),
                )
            }
        }
    }

    fun onEvent(event: DealerUiEvent) {
        when (event) {
            is DealerUiEvent.FormChanged -> _state.update { it.copy(form = event.form) }
            DealerUiEvent.Claim -> claim()
            is DealerUiEvent.BenchmarkUrlsChanged -> _state.update { it.copy(benchmarkUrls = event.urls) }
            DealerUiEvent.RunBenchmark -> runBenchmark()
            DealerUiEvent.SignOut -> signOut()
            DealerUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun claim() {
        val f = _state.value.form
        if (f.displayName.isBlank() || f.phone.isBlank() || f.email.isBlank()) {
            _state.update { it.copy(error = "Display name, phone and email are required to claim.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(claiming = true, error = null) }
            // DealerRepository.claim carries dealerName/contactEmail/contactPhone only;
            // the pattern/URL fields stay form-local (yard-tools v2 wires claimed_url).
            runCatching {
                repository.claim(
                    dealerName = f.displayName.trim(),
                    contactEmail = f.email.trim(),
                    contactPhone = f.phone.trim().ifBlank { null },
                )
            }.onSuccess { res ->
                val token = res.claimId.ifBlank { res.status }
                context.dealerStore.edit { prefs ->
                    prefs[ClaimTokenKey] = token
                    prefs[ClaimNameKey] = f.displayName.trim()
                    prefs[ClaimPhoneKey] = f.phone.trim()
                    prefs[ClaimEmailKey] = f.email.trim()
                }
                _state.update { it.copy(claiming = false, claimToken = token, claimedName = f.displayName.trim()) }
            }.onFailure { e ->
                _state.update { it.copy(claiming = false, error = e.message ?: "Claim failed.") }
            }
        }
    }

    private fun runBenchmark() {
        val name = _state.value.form.displayName.trim().ifBlank { _state.value.claimedName.trim() }
        if (_state.value.benchmarkUrls.lines().none { it.isNotBlank() } && name.isBlank()) {
            _state.update { it.copy(error = "Claim first, then paste listing URLs to benchmark.") }
            return
        }
        if (name.isBlank()) {
            _state.update { it.copy(error = "Enter your dealership display name first.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(benchmarking = true, error = null) }
            // Interface benchmark is dealerName-scoped; per-URL breakdown (benchmarkUrls)
            // is a DealerRepositoryImpl extra the yard-tools v2 screen will call directly.
            runCatching { repository.benchmark(name) }
                .onSuccess { b -> _state.update { it.copy(benchmarking = false, benchmark = b) } }
                .onFailure { e -> _state.update { it.copy(benchmarking = false, error = e.message ?: "Benchmark failed.") } }
        }
    }

    private fun signOut() {
        viewModelScope.launch {
            context.dealerStore.edit { it.clear() }
            _state.update { it.copy(claimToken = null, claimedName = "", benchmark = null) }
        }
    }

    /** Reactive token for interceptors owned by the data layer. */
    val claimTokenFlow = context.dealerStore.data.map { it[ClaimTokenKey] }
}
