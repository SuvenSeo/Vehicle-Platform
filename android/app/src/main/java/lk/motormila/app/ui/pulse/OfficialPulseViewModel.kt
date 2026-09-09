package lk.motormila.app.ui.pulse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.core.common.AppError
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.domain.model.MarketSignal
import lk.motormila.app.domain.model.Permit
import lk.motormila.app.domain.model.VehicleNews
import lk.motormila.app.domain.repository.InsightsRepository
import lk.motormila.app.domain.usecase.ObserveSessionUseCase

const val FREE_PULSE_LIMIT = 6
const val FREE_NEWS_LIMIT = 2
const val PRO_PULSE_LIMIT = 48
const val PRO_NEWS_LIMIT = 6

enum class PulseSection {
    SIGNALS,
    NEWS,
    PERMITS,
}

data class OfficialPulseUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val unlocked: Boolean = false,
    val section: PulseSection = PulseSection.SIGNALS,
    val signals: List<MarketSignal> = emptyList(),
    val news: List<VehicleNews> = emptyList(),
    val permits: List<Permit> = emptyList(),
    val sourceFilter: String = SOURCE_ALL,
    val offline: Boolean = false,
    val error: String? = null,
) {
    val sourceKeys: List<String>
        get() = signals.map { it.source.lowercase() }.distinct().sorted()

    val visibleSignals: List<MarketSignal>
        get() {
            val filtered = if (sourceFilter == SOURCE_ALL) {
                signals
            } else {
                signals.filter { it.source.equals(sourceFilter, ignoreCase = true) }
            }
            return if (unlocked) filtered else filtered.take(FREE_PULSE_LIMIT)
        }

    val visibleNews: List<VehicleNews>
        get() = if (unlocked) news else news.take(FREE_NEWS_LIMIT)

    companion object {
        const val SOURCE_ALL = "all"
    }
}

sealed interface OfficialPulseUiEvent {
    data object Refresh : OfficialPulseUiEvent
    data class SectionChanged(val section: PulseSection) : OfficialPulseUiEvent
    data class SourceFilterChanged(val source: String) : OfficialPulseUiEvent
    data object DismissError : OfficialPulseUiEvent
}

@HiltViewModel
class OfficialPulseViewModel @Inject constructor(
    private val repository: InsightsRepository,
    observeSession: ObserveSessionUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow(OfficialPulseUiState())
    val state: StateFlow<OfficialPulseUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            var first = true
            observeSession().collect { session ->
                val next = session?.isPro == true || session?.isAdmin == true
                val changed = next != _state.value.unlocked
                _state.update { it.copy(unlocked = next) }
                if (first || changed) {
                    load(refresh = !first)
                    first = false
                }
            }
        }
    }

    fun onEvent(event: OfficialPulseUiEvent) {
        when (event) {
            OfficialPulseUiEvent.Refresh -> load(refresh = true)
            is OfficialPulseUiEvent.SectionChanged -> _state.update { it.copy(section = event.section) }
            is OfficialPulseUiEvent.SourceFilterChanged ->
                _state.update { it.copy(sourceFilter = event.source) }
            OfficialPulseUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun load(refresh: Boolean = false) {
        viewModelScope.launch {
            _state.update {
                it.copy(isLoading = !refresh, isRefreshing = refresh, error = null, offline = false)
            }
            val unlocked = _state.value.unlocked
            val signalLimit = if (unlocked) PRO_PULSE_LIMIT else FREE_PULSE_LIMIT
            val newsLimit = if (unlocked) PRO_NEWS_LIMIT else FREE_NEWS_LIMIT

            val signalsDef = async { runCatching { repository.signals(signalLimit) } }
            val newsDef = async { runCatching { repository.news(newsLimit) } }
            val permitsDef = async { runCatching { repository.permits() } }

            val signalsResult = signalsDef.await()
            val newsResult = newsDef.await()
            val permitsResult = permitsDef.await()
            val failure = signalsResult.exceptionOrNull()
                ?: newsResult.exceptionOrNull()
                ?: permitsResult.exceptionOrNull()

            val signals = signalsResult.getOrDefault(emptyList())
            val news = newsResult.getOrDefault(emptyList())
            val permits = permitsResult.getOrDefault(emptyList())

            if (signals.isEmpty() && news.isEmpty() && permits.isEmpty() && failure != null) {
                val mapped = ErrorMapper.map(failure)
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        offline = mapped is AppError.Network,
                        error = mapped.message,
                    )
                }
            } else {
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        signals = signals,
                        news = news,
                        permits = permits,
                        offline = failure != null && ErrorMapper.map(failure) is AppError.Network,
                        error = null,
                    )
                }
            }
        }
    }
}
