package lk.motormila.app.ui.insights

import lk.motormila.app.domain.model.PriceIndex
import lk.motormila.app.domain.model.PriceIndexPoint
import kotlin.math.round

/** Locale-stable labels for the mix-adjusted price index. Pure JVM. */
object PriceIndexFormat {
    private val monthNames = listOf(
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    )

    fun periodLabel(period: String): String {
        val parts = period.split("-")
        if (parts.size < 2) return period
        val year = parts[0].toIntOrNull() ?: return period
        val month = parts[1].toIntOrNull()?.coerceIn(1, 12) ?: return period
        return "${monthNames[month - 1]} $year"
    }

    fun pct(value: Double?): String {
        if (value == null || !value.isFinite()) return "—"
        val rounded = round(value * 10.0) / 10.0
        val sign = if (rounded > 0) "+" else ""
        val rendered = if (rounded == rounded.toLong().toDouble()) {
            "${rounded.toLong()}.0"
        } else {
            rounded.toString()
        }
        return "$sign$rendered%"
    }

    fun pointsFor(index: PriceIndex, segment: String): List<PriceIndexPoint> {
        if (segment.isBlank() || segment.equals("overall", ignoreCase = true)) return index.points
        return index.segments[segment] ?: index.points
    }

    fun segmentKeys(index: PriceIndex): List<String> {
        val keys = linkedSetOf("overall")
        keys.addAll(index.segments.keys)
        return keys.toList()
    }

    fun totalChangePct(points: List<PriceIndexPoint>): Double? {
        val first = points.firstOrNull()?.indexValue ?: return null
        val latest = points.lastOrNull()?.indexValue ?: return null
        if (first <= 0.0) return null
        return ((latest - first) / first) * 100.0
    }

    fun segmentLabel(key: String): String =
        if (key.equals("overall", ignoreCase = true)) "All vehicles"
        else key.replace('_', ' ').replaceFirstChar { it.uppercase() }
}
