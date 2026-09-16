package lk.motormila.app.core.geo

/**
 * Canonical Sri Lanka district centres. Used when a stats payload omits lat/lng
 * (the backend sometimes returns 0,0 for sparse districts).
 */
object SriLankaDistricts {
    val names: List<String> = listOf(
        "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
        "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
        "Mullaitivu", "Vavuniya", "Batticaloa", "Ampara", "Trincomalee",
        "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
        "Monaragala", "Ratnapura", "Kegalle",
    )

    val coords: Map<String, Pair<Double, Double>> = mapOf(
        "Colombo" to (6.9271 to 79.8612),
        "Gampaha" to (7.084 to 80.0098),
        "Kalutara" to (6.5854 to 79.9607),
        "Kandy" to (7.2906 to 80.6337),
        "Matale" to (7.4675 to 80.6234),
        "Nuwara Eliya" to (6.9497 to 80.7891),
        "Galle" to (6.0535 to 80.221),
        "Matara" to (5.9549 to 80.555),
        "Hambantota" to (6.1243 to 81.1185),
        "Jaffna" to (9.6615 to 80.0255),
        "Kilinochchi" to (9.3803 to 80.377),
        "Mannar" to (8.981 to 79.9044),
        "Vavuniya" to (8.7514 to 80.4971),
        "Mullaitivu" to (9.2671 to 80.8142),
        "Batticaloa" to (7.731 to 81.6747),
        "Ampara" to (7.2964 to 81.6747),
        "Trincomalee" to (8.5874 to 81.2152),
        "Kurunegala" to (7.4863 to 80.3647),
        "Puttalam" to (8.0362 to 79.8283),
        "Anuradhapura" to (8.3114 to 80.4037),
        "Polonnaruwa" to (7.9403 to 81.0188),
        "Badulla" to (6.9934 to 81.055),
        "Monaragala" to (6.8728 to 81.3507),
        "Ratnapura" to (6.6828 to 80.3992),
        "Kegalle" to (7.2513 to 80.3464),
    )

    /** Island bounding box used to project lat/lng onto a canvas. */
    const val MIN_LAT = 5.85
    const val MAX_LAT = 9.85
    const val MIN_LNG = 79.55
    const val MAX_LNG = 81.95

    fun coordFor(district: String, lat: Double, lng: Double): Pair<Double, Double> {
        if (lat != 0.0 && lng != 0.0) return lat to lng
        val exact = coords[district]
        if (exact != null) return exact
        val folded = coords.entries.firstOrNull { it.key.equals(district, ignoreCase = true) }
        return folded?.value ?: (7.8731 to 80.7718)
    }

    fun project(lat: Double, lng: Double, width: Float, height: Float, pad: Float = 18f): Pair<Float, Float> {
        val nx = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)).toFloat().coerceIn(0f, 1f)
        val ny = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)).toFloat().coerceIn(0f, 1f)
        val x = pad + nx * (width - pad * 2)
        val y = pad + ny * (height - pad * 2)
        return x to y
    }
}
