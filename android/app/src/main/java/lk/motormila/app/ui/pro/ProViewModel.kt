package lk.motormila.app.ui.pro

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.domain.model.ArbitrageGap
import lk.motormila.app.domain.model.ProDistrict
import lk.motormila.app.domain.model.ProSnapshot
import lk.motormila.app.domain.model.VehicleLane
import lk.motormila.app.domain.repository.AuthRepository
import lk.motormila.app.domain.repository.ProRepository

data class ProUiState(
    val isPro: Boolean = false,
    val planName: String = "Free",
    val isLoading: Boolean = true,
    val snapshot: ProSnapshot? = null,
    val lanes: List<VehicleLane> = emptyList(),
    val districts: List<ProDistrict> = emptyList(),
    val arbitrage: List<ArbitrageGap> = emptyList(),
    val checkoutUrl: String? = null,
    val error: String? = null,
)

sealed interface ProUiEvent {
    data object Refresh : ProUiEvent
    data object CheckoutIntent : ProUiEvent
    data object DismissError : ProUiEvent
}

@HiltViewModel
class ProViewModel @Inject constructor(
    private val proRepository: ProRepository,
    authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ProUiState())
    val state: StateFlow<ProUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            // AuthRepository.session() is the session source of truth (no SessionRepository exists).
            authRepository.session().collect { session ->
                val isPro = session?.isPro == true
                val plan = session?.plan?.ifBlank { null }?.replaceFirstChar { c -> c.uppercase() } ?: "Free"
                _state.update { it.copy(isPro = isPro, planName = plan) }
                if (isPro) loadSnapshot() else _state.update { it.copy(isLoading = false) }
            }
        }
    }

    fun onEvent(event: ProUiEvent) {
        when (event) {
            ProUiEvent.Refresh -> if (_state.value.isPro) loadSnapshot()
            ProUiEvent.CheckoutIntent -> checkout()
            ProUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun loadSnapshot() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            runCatching {
                val snap = proRepository.snapshot()
                val lanes = runCatching { proRepository.lanes() }.getOrDefault(emptyList())
                val districts = runCatching { proRepository.districts() }.getOrDefault(emptyList())
                val arb = runCatching { proRepository.arbitrage() }.getOrDefault(emptyList())
                snap to Triple(lanes, districts, arb)
            }.onSuccess { (snap, rest) ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        snapshot = snap,
                        lanes = rest.first,
                        districts = rest.second,
                        arbitrage = rest.third,
                    )
                }
            }.onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message) } }
        }
    }

    private fun checkout() {
        // No checkout endpoint on ProRepository; use the static Pro page (opened via LocalUriHandler).
        _state.update { it.copy(checkoutUrl = null) }
        _state.update { it.copy(checkoutUrl = CHECKOUT_URL) }
    }

    companion object {
        const val CHECKOUT_URL = "https://motormila.vercel.app/pro"
    }
}

/** Convenience for the scaffold badge / upsell surfaces. */
val ProUiState.showPaywall: Boolean get() = !isPro
