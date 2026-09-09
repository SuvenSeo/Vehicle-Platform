package lk.motormila.app.core.locale

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * Per-app language via AppCompat (en / si / ta), matching the web LocaleSwitcher.
 *
 * [apply] / [applyFromStore] call
 * `AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))`.
 * On API 33+ the platform LocaleManager picks this up for any Activity. On API 26–32
 * AppCompat applies it to AppCompatActivity through attachBaseContext; a
 * ComponentActivity can wrap [android.content.Context.createConfigurationContext]
 * with the same tag if a pre-33 host never migrates to AppCompatActivity.
 *
 * Call [applyFromStore] from Application.onCreate so a persisted code is active
 * before the first frame. Settings applies immediately on change.
 */
object LocaleHelper {

    const val DEFAULT = "en"

    val SUPPORTED = setOf("en", "si", "ta")

    fun normalize(code: String?): String {
        val tag = code?.trim()?.lowercase().orEmpty()
        return if (tag in SUPPORTED) tag else DEFAULT
    }

    fun apply(code: String) {
        val tag = normalize(code)
        val requested = LocaleListCompat.forLanguageTags(tag)
        val current = AppCompatDelegate.getApplicationLocales()
        if (!current.isEmpty && current.toLanguageTags().equals(tag, ignoreCase = true)) {
            return
        }
        AppCompatDelegate.setApplicationLocales(requested)
    }

    /** Re-apply a code loaded from [lk.motormila.app.data.local.datastore.SettingsStore]. */
    fun applyFromStore(code: String) = apply(code)
}
