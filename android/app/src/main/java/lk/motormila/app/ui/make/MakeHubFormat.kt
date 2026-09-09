package lk.motormila.app.ui.make

import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.Locale
import lk.motormila.app.domain.model.TrendPoint

internal const val MAKE_HUB_RECENT_LIMIT = 4
internal const val MAKE_HUB_TREND_LIMIT = 12

internal fun decodeHubSlug(slug: String): String {
    if (slug.isBlank()) return slug
    return runCatching { URLDecoder.decode(slug, StandardCharsets.UTF_8.name()) }
        .getOrDefault(slug)
}

/** Title-case a URL slug (`toyota` → `Toyota`, `land-cruiser` → `Land Cruiser`). */
internal fun titleCaseSlug(slug: String): String {
    val decoded = decodeHubSlug(slug).trim()
    if (decoded.isEmpty()) return decoded
    return decoded
        .split(Regex("[-_\\s]+"))
        .filter { it.isNotEmpty() }
        .joinToString(" ") { word ->
            word.lowercase(Locale.ROOT).replaceFirstChar { ch -> ch.titlecase(Locale.ROOT) }
        }
}

internal fun hubDisplayName(canonical: String?, slug: String): String {
    val trimmed = canonical?.trim().orEmpty()
    if (trimmed.isNotEmpty()) return trimmed
    return titleCaseSlug(slug)
}

internal fun hubVehicleLabel(make: String, model: String): String =
    listOf(make, model).filter { it.isNotBlank() }.joinToString(" ")

internal fun trendPointPrice(point: TrendPoint): Double? =
    point.medianPriceLkr ?: point.avgPriceLkr

internal fun searchArg(canonical: String?, slug: String): String {
    val trimmed = canonical?.trim().orEmpty()
    if (trimmed.isNotEmpty()) return trimmed
    return decodeHubSlug(slug).trim().ifBlank { slug }
}
