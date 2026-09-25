package lk.motormila.app.core.format

/**
 * Top-level shims over [LkrFormat] for call sites that import plain
 * `formatLkr` / `formatPct` / `parseLkrShorthand` functions.
 */
fun formatLkr(value: Double?): String = LkrFormat.price(value)

fun formatLkr(value: Long?): String = LkrFormat.price(value?.toDouble())

fun formatLkr(value: Int?): String = LkrFormat.price(value?.toDouble())

/** "Rs. 12.4M" (1-decimal) at/above 1M, else grouped rupees. */
fun formatLkrCompact(value: Double?): String {
    if (value == null || value <= 0) return LkrFormat.price(value)
    return if (value >= 1_000_000) {
        val m = value / 1_000_000.0
        "Rs. ${"%.1f".format(m).trimEnd('0').trimEnd('.')}M"
    } else {
        LkrFormat.full(value)
    }
}

/** "Rs. 12.4M" (1-decimal) at/above 1M, else grouped rupees. */
fun formatLkrCompact(value: Long?): String = formatLkrCompact(value?.toDouble())

/** Signed grouped delta, e.g. "-Rs. 250,000". Blank when null/zero. */
fun formatLkrDelta(value: Double?): String = LkrFormat.deltaLkr(value)

/** Signed grouped delta, e.g. "-Rs. 250,000". Blank when null/zero. */
fun formatLkrDelta(value: Long?): String = LkrFormat.deltaLkr(value?.toDouble())

/** Signed percent with [digits] decimals, e.g. "+2.5%". Null renders as "—". */
fun formatPct(value: Double?, digits: Int = 1): String {
    if (value == null) return "—"
    val sign = if (value > 0) "+" else ""
    return "$sign${"%.${digits}f".format(value)}%"
}

private val ShorthandNumber = Regex("""^([0-9]*\.?[0-9]+)([a-z]*)$""")

/**
 * Parse LKR shorthand into rupees: "8m", "8.5M", "12,450,000", "850k",
 * "85L", "85 lakhs", "1.2cr", "1.2 crore", "3 million".
 * Units: k=1e3, m/mn/million=1e6, l/lakh(s)=1e5, cr/crore=1e7, b=1e9.
 * Returns null when unparseable.
 */
fun parseLkrShorthand(raw: String): Double? {
    var s = raw.trim().lowercase()
    if (s.isEmpty()) return null
    s = s.removePrefix("lkr").removePrefix("rs").trim().trimStart('.').trim()
    if (s.isEmpty()) return null
    s = s.replace(",", "").replace(" ", "")
    if (s.isEmpty()) return null
    val match = ShorthandNumber.matchEntire(s) ?: return null
    val number = match.groupValues[1].toDoubleOrNull() ?: return null
    val multiplier = when (match.groupValues[2]) {
        "" -> 1.0
        "k" -> 1e3
        "m", "mn", "million", "millions" -> 1e6
        "l", "lakh", "lakhs" -> 1e5
        "cr", "crore", "crores" -> 1e7
        "b", "bn", "billion", "billions" -> 1e9
        else -> return null
    }
    return number * multiplier
}
