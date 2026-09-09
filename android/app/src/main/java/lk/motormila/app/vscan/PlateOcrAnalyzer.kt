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

    /**
     * Pure function: extracts normalized Sri Lankan plate candidates from OCR
     * text. Delegates to canonical [lk.motormila.app.ui.scan.PlateParser] so
     * camera OCR and manual entry parse identically. Kept here for call-site
     * compat (CameraX path); new code should import PlateParser directly.
     */
    fun extractPlateCandidates(text: String): List<String> =
        lk.motormila.app.ui.scan.PlateParser.extract(text)
}
