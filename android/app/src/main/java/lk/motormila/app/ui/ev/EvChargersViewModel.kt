package lk.motormila.app.ui.ev

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.core.geo.SriLankaDistricts
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.domain.model.ChargingStation
import lk.motormila.app.domain.repository.InsightsRepository

data class EvChargersUiState(
    val district: String = "Colombo",
    val radiusKm: Int = 25,
    val stations: List<ChargingStation> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

sealed interface EvChargersUiEvent {
    data class DistrictChanged(val district: String) : EvChargersUiEvent
    data class RadiusChanged(val km: Int) : EvChargersUiEvent
    data object Retry : EvChargersUiEvent
}

@HiltViewModel
class EvChargersViewModel @Inject constructor(
    private val insights: InsightsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(EvChargersUiState())
    val state: StateFlow<EvChargersUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun onEvent(event: EvChargersUiEvent) {
        when (event) {
            is EvChargersUiEvent.DistrictChanged -> {
                _state.update { it.copy(district = event.district) }
                load()
            }
            is EvChargersUiEvent.RadiusChanged -> {
                _state.update { it.copy(radiusKm = event.km) }
                load()
            }
            EvChargersUiEvent.Retry -> load()
        }
    }

    private fun load() {
        viewModelScope.launch {
            val s = _state.value
            _state.update { it.copy(isLoading = true, error = null) }
            val (lat, lng) = SriLankaDistricts.coords[s.district] ?: (6.9271 to 79.8612)
            runCatching { insights.chargers(lat, lng, s.radiusKm.toDouble()) }
                .onSuccess { stations ->
                    _state.update { it.copy(isLoading = false, stations = stations) }
                }
                .onFailure { error ->
                    _state.update { it.copy(isLoading = false, error = ErrorMapper.map(error).message) }
                }
        }
    }
}
