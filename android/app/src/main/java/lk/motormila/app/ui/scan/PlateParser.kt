package lk.motormila.app.ui.scan

/**
 * Canonical Sri Lankan plate parsing — pure Kotlin, zero android.* imports.
 *
 * Supported (normalised to upper-case, single spaces, `-` before final 4 digits):
 * - `WP CA-1234`, `WP AB-1234` (province + letters + digits)
 * - `CAB-1234`, `BAA-1234`, `ABC 1234` (letters + digits)
 * - `12-3456`, `65-4321` (legacy numeric-only)
 * - Spaceless OCR output `WPABC1234` → `WP ABC 1234` (best-effort spacing)
 *
 * Both [PlateScanViewModel] (top-level [normalisePlate]/[extractPlateCandidates]
 * delegate here for test compat) and [lk.motormila.app.vscan.PlateOcrAnalyzer]
 * converge on this file so OCR and manual entry parse identically.
 */
object PlateParser {

    // 2-group: letters + 4 digits (CAB-1234). 3-group: province + letters + digits.
    // Numeric: 1-3 digits + 4 digits (12-3456). Spaceless run handled by fallback.
    private val ThreeGroup = Regex("""\b([A-Z]{2,3})[\s-]*([A-Z]{1,3})[\s-]*([0-9]{3,4})\b""")
    private val TwoGroup = Regex("""\b([A-Z]{1,3})[\s-]*([0-9]{4})\b""")
    private val NumericOnly = Regex("""\b([0-9]{1,3})[\s-]*([0-9]{4})\b""")
    private val Spaceless = Regex("""\b([A-Z]{2,6})([0-9]{3,4})\b""")

    /** Normalise OCR spacing: `WP CA 1234` → `WP CA-1234`. Pure + unit-testable. */
    fun normalise(raw: String): String =
        raw.uppercase().trim().replace(Regex("""\s+"""), " ")
            .replace(Regex(""" ([0-9]{4})$"""), "-$1")

    /**
     * Extract plate-like candidates from OCR text. Prefers matches with both
     * letters and digits, but keeps legacy numeric-only plates (`12-3456`).
     * Dedupes, longest-first, max 5.
     */
    fun extract(ocrText: String): List<String> {
        if (ocrText.isBlank()) return emptyList()
        val upper = ocrText.uppercase()
        val found = linkedSetOf<String>()
        for (pattern in listOf(ThreeGroup, TwoGroup, NumericOnly)) {
            for (m in pattern.findAll(upper)) {
                val normalized = normalise(m.value)
                if (isPlausible(normalized)) found.add(normalized)
            }
        }
        // Spaceless fallback: WPABC1234 → WPABC 1234 → normalise.
        if (found.isEmpty()) {
            for (m in Spaceless.findAll(upper)) {
                val spaced = "${m.groupValues[1]} ${m.groupValues[2]}"
                val normalized = normalise(spaced)
                if (isPlausible(normalized)) found.add(normalized)
            }
        }
        return found.sortedByDescending { it.length }.take(5)
    }

    private fun isPlausible(plate: String): Boolean {
        if (plate.length !in 5..14) return false
        val letters = plate.count { it.isLetter() }
        val digits = plate.count { it.isDigit() }
        // Letters+digits preferred; numeric-only legacy allowed when 5+ digits total.
        return (letters in 1..6 && digits in 3..6) ||
            (letters == 0 && digits in 5..7)
    }
}
