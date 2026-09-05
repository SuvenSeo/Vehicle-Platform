package lk.motormila.app.core.format

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs

/** LKR formatting shared by all UI. "Rs. 12.45M" >= 1M, else grouped rupees. */
object LkrFormat {
    private val grouped: NumberFormat =
        NumberFormat.getNumberInstance(Locale("en", "LK")).apply { maximumFractionDigits = 0 }

    fun price(value: Double?): String {
        if (value == null || value <= 0) return "Price on request"
        return if (value >= 1_000_000) {
            val m = value / 1_000_000.0
            val text = if (m >= 100) "%.1f".format(m) else "%.2f".format(m)
            "Rs. ${text.trimEnd('0').trimEnd('.')}M"
        } else {
            "Rs. ${grouped.format(value)}"
        }
    }

    fun full(value: Double?): String {
        if (value == null || value <= 0) return "Price on request"
        return "Rs. ${grouped.format(value)}"
    }

    fun deltaPct(value: Double?): String {
        if (value == null) return ""
        val sign = if (value > 0) "+" else ""
        return "$sign${"%.1f".format(value)}%"
    }

    fun deltaLkr(value: Double?): String {
        if (value == null || value == 0.0) return ""
        val sign = if (value > 0) "+" else "−"
        return "$sign${full(abs(value)).removePrefix("Rs. ").let { "Rs. $it" }}"
    }

    fun km(value: Double?): String {
        if (value == null || value <= 0) return "—"
        return "${grouped.format(value)} km"
    }

    fun count(value: Int): String = grouped.format(value.toLong())
}
