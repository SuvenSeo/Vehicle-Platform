package lk.motormila.app.ui.permits

object PermitLabels {
    fun displayType(raw: String): String {
        val key = raw.trim().lowercase()
        return when (key) {
            "assembled" -> "Assembled vehicle"
            "full_import" -> "Full import"
            "retirement_cat1", "retirement_cat_1" -> "Retirement Cat. I"
            "retirement_cat2", "retirement_cat_2" -> "Retirement Cat. II"
            "retirement_cat3", "retirement_cat_3" -> "Retirement Cat. III"
            "duty_free" -> "Duty-free"
            "ev" -> "EV / Remittance"
            "general" -> "General"
            "" -> "Unspecified"
            else -> key.replace('_', ' ').replaceFirstChar { it.uppercase() }
        }
    }

    fun uniqueTypeCount(types: List<String>): Int =
        types.map { displayType(it) }.toSet().size
}
