package lk.motormila.app.vscan

import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Number-plate OCR via ML Kit Text Recognition. No Activity/Fragment refs —
 * pure CameraX [ImageProxy] in, raw-text Flow out. Plate filtering is the pure
 * function [extractPlateCandidates] (unit-testable, no Android deps).
 *
 * Sri Lankan plates: `WP AB-1234`, `CAB-5678`, `12-3456`, `ABC 1234`,
 * bike `BAA-1234`, old `65-4321`… normalized to upper-case, single spaces.
 */
object PlateOcrAnalyzer {

    private val recognizer by lazy {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }

    /**
     * Runs recognition on [imageProxy] and emits the full raw text (or "" on
     * failure). Always closes [imageProxy].
     */
    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    fun analyze(imageProxy: ImageProxy): Flow<String> = callbackFlow {
        val media = imageProxy.image
        if (media == null) {
            imageProxy.close()
            trySend("")
            close()
            return@callbackFlow
        }
        val input = InputImage.fromMediaImage(media, imageProxy.imageInfo.rotationDegrees)
        recognizer.process(input)
            .addOnSuccessListener { visionText -> trySend(visionText.text ?: "") }
            .addOnFailureListener { trySend("") }
            .addOnCompleteListener {
                imageProxy.close()
                close()
            }
        awaitClose { runCatching { imageProxy.close() } }
    }

    // Matches: "WP AB 1234", "WP-AB-1234", "CAB 5678", "ABC-1234", "12-3456",
    // "BAA 1234", "65 4321", "WPABC1234" (spaceless), with optional separators.
    private val PLATE_PATTERNS = listOf(
        Regex("\\b([A-Z]{2,3})[\\s-]*([A-Z]{1,3})[\\s-]*([0-9]{3,4})\\b"),
        Regex("\\b([A-Z]{1,3})[\\s-]*([0-9]{4})\\b"),
        Regex("\\b([0-9]{1,2})[\\s-]*([0-9]{4})\\b"),
    )

    /**
     * Pure function: extracts normalized Sri Lankan plate candidates from OCR
     * text. Normalization: upper-case, collapse whitespace to single spaces,
     * prefer matches containing both letters and digits, dedup, longest first.
     */
    fun extractPlateCandidates(text: String): List<String> {
        if (text.isBlank()) return emptyList()
        val upper = text.uppercase()
        val found = linkedSetOf<String>()
        for (pattern in PLATE_PATTERNS) {
            for (m in pattern.findAll(upper)) {
                val normalized = m.value.trim().replace(Regex("[\\s-]+"), " ")
                val letters = normalized.count { it.isLetter() }
                val digits = normalized.count { it.isDigit() }
                if (letters in 1..6 && digits in 3..6 && normalized.length in 5..14) {
                    found.add(normalized)
                }
            }
        }
        return found.sortedByDescending { it.length }
    }
}
