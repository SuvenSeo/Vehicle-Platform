package lk.motormila.app.ui.share

import android.net.Uri
import lk.motormila.app.domain.repository.ListingQuery

sealed interface ShareTarget {
    data class Search(val query: ListingQuery) : ShareTarget
    data class Compare(val ids: List<Int>) : ShareTarget
    data class Valuation(val make: String, val model: String) : ShareTarget
    data class Unsupported(val url: String) : ShareTarget
}

private val SupportedHosts = listOf("ikman.lk", "riyasewana.com", "patpat.lk")
private val IdInUrl = Regex("""(\d{5,})""")
private val SlugMakeModel = Regex("""/(?:en/)?ad/([a-z0-9]+)-([a-z0-9]+)""")

/**
 * Parse a shared marketplace URL into an in-app target.
 * Pure + unit-testable. Unsupported hosts → [ShareTarget.Unsupported] (error state).
 */
fun parseSharedUrl(sharedUrl: String?): ShareTarget {
    if (sharedUrl.isNullOrBlank()) return ShareTarget.Unsupported("")
    val uri = runCatching { Uri.parse(sharedUrl.trim()) }.getOrNull()
        ?: return ShareTarget.Unsupported(sharedUrl)
    val host = (uri.host ?: "").lowercase().removePrefix("www.")
    if (SupportedHosts.none { host == it || host.endsWith(".$it") }) {
        return ShareTarget.Unsupported(sharedUrl)
    }
    val id = IdInUrl.find(sharedUrl)?.groupValues?.get(1)?.toIntOrNull()
    val slug = SlugMakeModel.find(uri.path.orEmpty())
    val make = slug?.groupValues?.get(1)?.replaceFirstChar { it.uppercase() }
    val model = slug?.groupValues?.get(2)?.replaceFirstChar { it.uppercase() }
    return when {
        // Deep ad link with numeric id → jump straight to FMV/compare flow.
        id != null && make != null -> ShareTarget.Compare(listOf(id))
        id != null -> ShareTarget.Search(ListingQuery(keyword = id.toString(), make = make, model = model))
        make != null -> ShareTarget.Valuation(make, model.orEmpty())
        else -> ShareTarget.Search(ListingQuery(keyword = sharedUrl))
    }
}
