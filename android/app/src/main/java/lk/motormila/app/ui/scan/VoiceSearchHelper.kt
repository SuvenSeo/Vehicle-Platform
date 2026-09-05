package lk.motormila.app.ui.scan

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale
import lk.motormila.app.core.format.parseLkrShorthand
import lk.motormila.app.domain.repository.ListingQuery

/** Districts recognised inside voice queries (case-insensitive substring match). */
private val Districts = listOf(
    "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
    "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
    "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
    "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
    "Monaragala", "Ratnapura", "Kegalle",
)

private val YearPattern = Regex("""\b((?:19|20)\d{2})\b""")
private val UnderPricePattern = Regex("""(?:under|below|max|upto|up to)\s+([0-9]+(?:\.[0-9]+)?\s?[mk]?)""")

/**
 * Parse a voice transcript like `"Axio 2017 under 8m Colombo"` into a [ListingQuery].
 * Heuristic (documented): first token = make, second non-keyword token = model,
 * `\bYYYY\b` = year, `under <shorthand>` = max price, district substring = district.
 * Pure + unit-testable — the Search builder can reuse it for typed queries.
 */
fun parseVoiceQuery(transcript: String): ListingQuery {
    val text = transcript.trim()
    val lower = text.lowercase(Locale.US)
    val year = YearPattern.find(text)?.groupValues?.get(1)?.toIntOrNull()
    val maxPrice = UnderPricePattern.find(lower)?.groupValues?.get(1)?.let { parseLkrShorthand(it) }
    val district = Districts.firstOrNull { lower.contains(it.lowercase(Locale.US)) }
    val keywords = setOf("under", "below", "max", "upto", "up", "to", "in", "near", "around", "show", "find", "search", "for", "me", "car", "cars", "vehicle")
    val tokens = text.split(Regex("""\s+""")).filter { it.isNotBlank() }
    val significant = tokens.filter { t ->
        t.lowercase(Locale.US) !in keywords &&
            YearPattern.find(t) == null &&
            parseLkrShorthand(t) == null &&
            Districts.none { d -> d.equals(t, ignoreCase = true) }
    }
    return ListingQuery(
        keyword = text,
        make = significant.getOrNull(0)?.takeIf { it.isNotBlank() },
        model = significant.getOrNull(1)?.takeIf { it.isNotBlank() },
        yearMin = year,
        yearMax = year,
        priceMax = maxPrice,
        district = district,
    )
}

/**
 * SpeechRecognizer wrapper (si/ta/en via locale param). Never crashes when the
 * recogniser is absent — [isAvailable] gates the UI row.
 */
class VoiceSearchHelper(private val context: Context) {

    fun isAvailable(): Boolean =
        runCatching { SpeechRecognizer.isRecognitionAvailable(context) }.getOrDefault(false)

    fun recogniserIntent(locale: Locale = Locale.getDefault()): Intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale.toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }

    /** One-shot listen; results delivered to [onResult] as parsed [ListingQuery]. */
    fun listenOnce(
        locale: Locale = Locale.getDefault(),
        onResult: (ListingQuery) -> Unit,
        onError: (String) -> Unit,
    ) {
        if (!isAvailable()) {
            onError("Voice search isn't available on this device.")
            return
        }
        val recogniser = runCatching { SpeechRecognizer.createSpeechRecognizer(context) }.getOrNull()
        if (recogniser == null) {
            onError("Couldn't start voice search.")
            return
        }
        recogniser.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle) {
                val heard = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull().orEmpty()
                runCatching { recogniser.destroy() }
                if (heard.isBlank()) onError("Didn't catch that — try again.") else onResult(parseVoiceQuery(heard))
            }
            override fun onError(error: Int) {
                runCatching { recogniser.destroy() }
                onError("Voice error ($error) — try typing instead.")
            }
            override fun onReadyForSpeech(params: Bundle) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: Bundle) = Unit
            override fun onEvent(eventType: Int, params: Bundle) = Unit
        })
        runCatching { recogniser.startListening(recogniserIntent(locale)) }
            .onFailure { onError("Couldn't start voice search.") }
    }
}
