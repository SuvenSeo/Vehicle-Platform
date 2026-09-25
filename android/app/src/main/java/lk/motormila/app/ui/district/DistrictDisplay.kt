package lk.motormila.app.ui.district

import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.DistrictVelocity

const val NEARBY_DISTRICT_LIMIT = 6

/** Nearby-district chip used as the mobile stand-in for the web heatmap. */
data class NearbyDistrict(
    val district: String,
    val count: Int,
    val avgPriceLkr: Double?,
    val new7dCount: Int? = null,
)

/** URL-decode a route slug; returns [raw] when decoding fails. */
fun decodeDistrictSlug(raw: String): String {
    if (raw.isEmpty()) return raw
    return runCatching { URLDecoder.decode(raw, StandardCharsets.UTF_8.name()) }.getOrDefault(raw)
}

/**
 * Title-case a district slug for display when the API name is blank.
 * `"nuwara-eliya"` → `"Nuwara Eliya"`.
 */
fun titleCaseDistrict(raw: String): String {
    val decoded = decodeDistrictSlug(raw).trim()
    if (decoded.isEmpty()) return ""
    return decoded
        .split(Regex("[-_\\s]+"))
        .filter { it.isNotEmpty() }
        .joinToString(" ") { word ->
            word.lowercase(Locale.ROOT).replaceFirstChar { ch ->
                if (ch.isLowerCase()) ch.titlecase(Locale.ROOT) else ch.toString()
            }
        }
}

/** Prefer the API canonical name; fall back to a title-cased route slug. */
fun displayDistrictName(insightDistrict: String?, routeDistrict: String): String {
    val fromInsight = insightDistrict?.trim().orEmpty()
    if (fromInsight.isNotBlank()) return fromInsight
    return titleCaseDistrict(routeDistrict)
}

fun districtMatchKey(name: String): String =
    name.lowercase(Locale.ROOT).replace(Regex("[\\s_-]+"), "")

/**
 * Other districts from [prices], ranked by geographic distance when the
 * current district is on the map, otherwise by listing count.
 */
fun nearbyDistricts(
    currentNames: Collection<String>,
    prices: List<DistrictStat>,
    velocities: List<DistrictVelocity> = emptyList(),
    limit: Int = NEARBY_DISTRICT_LIMIT,
): List<NearbyDistrict> {
    val currentKeys = currentNames
        .map { districtMatchKey(it) }
        .filter { it.isNotEmpty() }
        .toSet()
    val current = prices.firstOrNull { districtMatchKey(it.district) in currentKeys }
    val velocityByKey = velocities.associateBy { districtMatchKey(it.district) }
    val others = prices.filter { districtMatchKey(it.district) !in currentKeys }
    val ranked = if (current != null) {
        others.sortedBy { haversineKm(current.lat, current.lng, it.lat, it.lng) }
    } else {
        others.sortedByDescending { it.count }
    }
    return ranked.take(limit).map { stat ->
        val vel = velocityByKey[districtMatchKey(stat.district)]
        NearbyDistrict(
            district = stat.district,
            count = stat.count,
            avgPriceLkr = stat.avgPriceLkr,
            new7dCount = vel?.new7dCount,
        )
    }
}

internal fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val radiusKm = 6371.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
        sin(dLng / 2) * sin(dLng / 2)
    return 2 * radiusKm * atan2(sqrt(a), sqrt(1 - a))
}
