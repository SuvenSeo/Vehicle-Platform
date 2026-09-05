package lk.motormila.app.ui.scan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.domain.model.PlateLookupResult
import lk.motormila.app.domain.repository.ListingRepository

/** Sri Lankan plates: `CAB-1234`, `WP CA-1234`, `12-3456`, `ABC 1234` … */
private val PlatePattern = Regex("""\b([A-Z]{1,3}\s?-?\s?\d{1,4}|\d{1,3}\s?-?\s?\d{4})\b""")

/** Normalise OCR spacing: `WP CA 1234` → `WP CA-1234`. Pure + unit-testable. */
fun normalisePlate(raw: String): String =
    raw.uppercase().trim().replace(Regex("""\s+"""), " ")
        .replace(Regex(""" ([0-9]{4})$"""), "-$1")

/** Extract plate-like candidates from a block of OCR text. Pure + unit-testable. */
fun extractPlateCandidates(ocrText: String): List<String> =
    PlatePattern.findAll(ocrText.uppercase())
        .map { normalisePlate(it.value) }
        .filter { it.any { c -> c.isDigit() } && it.any { c -> c.isLetter() } }
        .distinct()
        .take(5)
        .toList()

data class PlateScanUiState(
    val permissionGranted: Boolean = false,
    val permissionRationaleVisible: Boolean = false,
    val cameraAvailable: Boolean = true,
    val ocrCandidates: List<String> = emptyList(),
    val selectedPlate: String? = null,
    val manualEntry: String = "",
    val lookingUp: Boolean = false,
    val result: PlateLookupResult? = null,
    val error: String? = null,
)

sealed interface PlateScanUiEvent {
    data class PermissionResult(val granted: Boolean, val showRationale: Boolean) : PlateScanUiEvent
    data class CameraAvailability(val available: Boolean) : PlateScanUiEvent
    data class OcrText(val text: String) : PlateScanUiEvent
    data class CandidateSelected(val plate: String) : PlateScanUiEvent
    data class ManualChanged(val value: String) : PlateScanUiEvent
    data object LookupManual : PlateScanUiEvent
    data object DismissError : PlateScanUiEvent
    data object ClearResult : PlateScanUiEvent
}

@HiltViewModel
class PlateScanViewModel @Inject constructor(
    private val repository: ListingRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(PlateScanUiState())
    val state: StateFlow<PlateScanUiState> = _state.asStateFlow()

    private var debounce: Job? = null

    fun onEvent(event: PlateScanUiEvent) {
        when (event) {
            is PlateScanUiEvent.PermissionResult -> _state.update {
                it.copy(
                    permissionGranted = event.granted,
                    permissionRationaleVisible = !event.granted && event.showRationale,
                )
            }
            is PlateScanUiEvent.CameraAvailability -> _state.update { it.copy(cameraAvailable = event.available) }
            is PlateScanUiEvent.OcrText -> onOcr(event.text)
            is PlateScanUiEvent.CandidateSelected -> {
                _state.update { it.copy(selectedPlate = event.plate, result = null) }
                lookup(event.plate)
            }
            is PlateScanUiEvent.ManualChanged -> _state.update { it.copy(manualEntry = event.value.uppercase()) }
            PlateScanUiEvent.LookupManual -> {
                val plate = normalisePlate(_state.value.manualEntry)
                if (plate.isBlank()) {
                    _state.update { it.copy(error = "Type the plate number first.") }
                } else {
                    _state.update { it.copy(selectedPlate = plate, result = null) }
                    lookup(plate)
                }
            }
            PlateScanUiEvent.DismissError -> _state.update { it.copy(error = null) }
            PlateScanUiEvent.ClearResult -> _state.update { it.copy(result = null, selectedPlate = null) }
        }
    }

    private fun onOcr(text: String) {
        if (text.isBlank()) return
        // Debounce: ML Kit fires per frame; re-parse at most every 800ms.
        debounce?.cancel()
        debounce = viewModelScope.launch {
            delay(800)
            val candidates = extractPlateCandidates(text)
            if (candidates.isNotEmpty()) {
                _state.update { it.copy(ocrCandidates = (candidates + it.ocrCandidates).distinct().take(5)) }
            }
        }
    }

    private fun lookup(plate: String) {
        viewModelScope.launch {
            _state.update { it.copy(lookingUp = true, error = null) }
            runCatching { repository.lookupByPlate(plate) }
                .onSuccess { r -> _state.update { it.copy(lookingUp = false, result = r) } }
                .onFailure { e ->
                    _state.update { it.copy(lookingUp = false, error = e.message ?: "Plate lookup failed.") }
                }
        }
    }
}
