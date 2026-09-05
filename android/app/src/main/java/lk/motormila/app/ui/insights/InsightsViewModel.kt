package lk.motormila.app.ui.insights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.EvStats
import lk.motormila.app.domain.model.PriceIndexPoint
import lk.motormila.app.domain.model.PulseSignal
import lk.motormila.app.domain.model.TrendPoint
import lk.motormila.app.domain.model.VehicleNews
import lk.motormila.app.domain.repository.InsightsRepository

data class TrendSelectors(
    val make: String = "",
    val model: String = "",
    val condition: String = "Any",
    val district: String = "All districts",
)

data class InsightsUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val selectors: TrendSelectors = TrendSelectors(),
    val trends: List<TrendPoint> = emptyList(),
    val trendCoverageNote: String? = null,
    val index: List<PriceIndexPoint> = emptyList(),
    val districts: List<DistrictStat> = emptyList(),
    val ev: EvStats? = null,
    val chargerRadiusKm: Int = 25,
    val chargers: List<String> = emptyList(),
    val pulse: List<PulseSignal> = emptyList(),
    val news: List<VehicleNews> = emptyList(),
    val error: String? = null,
)

sealed interface InsightsUiEvent {
    data object Refresh : InsightsUiEvent
    data class SelectorsChanged(val selectors: TrendSelectors) : InsightsUiEvent
    data class ChargerRadiusChanged(val km: Int) : InsightsUiEvent
    data object DismissError : InsightsUiEvent
}

@HiltViewModel
class InsightsViewModel @Inject constructor(
    private val repository: InsightsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(InsightsUiState())
    val state: StateFlow<InsightsUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun onEvent(event: InsightsUiEvent) {
        when (event) {
            InsightsUiEvent.Refresh -> load(refresh = true)
            is InsightsUiEvent.SelectorsChanged -> {
                _state.update { it.copy(selectors = event.selectors) }
                loadTrends()
            }
            is InsightsUiEvent.ChargerRadiusChanged -> {
                _state.update { it.copy(chargerRadiusKm = event.km) }
                loadChargers()
            }
            InsightsUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    /** Blank/"Any"/"All districts" selector values mean "no filter" for the API. */
    private fun TrendSelectors.toFilter(name: String): String? {
        val raw = when (name) {
            "make" -> make
            "model" -> model
            "condition" -> condition
            "district" -> district
            else -> ""
        }.trim()
        if (raw.isBlank()) return null
        if (raw.equals("Any", ignoreCase = true)) return null
        if (raw.equals("All districts", ignoreCase = true)) return null
        return raw
    }

    private fun formatCharger(name: String, distanceKm: Double?): String =
        "$name · ${distanceKm?.let { "%.1f km".format(it) } ?: "nearby"}"

    private fun load(refresh: Boolean = false) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = !refresh, isRefreshing = refresh, error = null) }
            runCatching {
                val s = _state.value.selectors
                val trends = repository.trends(
                    make = s.toFilter("make"),
                    model = s.toFilter("model"),
                    condition = s.toFilter("condition"),
                    district = s.toFilter("district"),
                )
                val index = repository.index()
                val districts = repository.districts()
                // Auxiliary sections fail independently — one outage must not blank the rest.
                val ev = runCatching { repository.evStats() }.getOrNull()
                val km = _state.value.chargerRadiusKm
                val chargers = runCatching { repository.chargers(radiusKm = km.toDouble()) }
                    .getOrDefault(emptyList())
                    .map { formatCharger(it.name, it.distanceKm) }
                val pulse = runCatching { repository.signals() }
                    .getOrDefault(emptyList())
                    .map {
                        PulseSignal(
                            id = it.id.toString(),
                            title = it.metric.ifBlank { it.signalType },
                            tag = it.source,
                            body = "${it.signalType} · ${it.valueNumeric?.toString().orEmpty()} ${it.unit.orEmpty()}".trim(),
                            timeLabel = it.observedAt.take(10),
                        )
                    }
                val news = runCatching { repository.news() }.getOrDefault(emptyList())
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        trends = trends.points,
                        trendCoverageNote = trends.coverageNote,
                        index = index.points,
                        districts = districts,
                        ev = ev,
                        chargers = chargers,
                        pulse = pulse,
                        news = news,
                    )
                }
            }.onFailure { e ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        error = e.message ?: "Couldn't load insights.",
                    )
                }
            }
        }
    }

    private fun loadTrends() {
        viewModelScope.launch {
            runCatching {
                val s = _state.value.selectors
                repository.trends(
                    make = s.toFilter("make"),
                    model = s.toFilter("model"),
                    condition = s.toFilter("condition"),
                    district = s.toFilter("district"),
                )
            }.onSuccess { result ->
                _state.update { it.copy(trends = result.points, trendCoverageNote = result.coverageNote) }
            }.onFailure { e ->
                _state.update { it.copy(error = e.message ?: "Couldn't load trends.") }
            }
        }
    }

    private fun loadChargers() {
        viewModelScope.launch {
            runCatching { repository.chargers(radiusKm = _state.value.chargerRadiusKm.toDouble()) }
                .onSuccess { list ->
                    _state.update { it.copy(chargers = list.map { formatCharger(it.name, it.distanceKm) }) }
                }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Couldn't load chargers.") } }
        }
    }
}
