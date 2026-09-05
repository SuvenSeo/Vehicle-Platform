package lk.motormila.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dagger.hilt.android.AndroidEntryPoint
import lk.motormila.app.ui.navigation.MotormilaNavGraph
import lk.motormila.app.ui.theme.MotormilaTheme

/**
 * Launcher activity. Forwards share intents into the nav graph via the
 * [SHARED_URL_KEY] saved-state key consumed by the ShareImport route.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MotormilaTheme {
                MotormilaNavGraph(sharedUrl = extractSharedUrl(intent))
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Recompose path: NavGraph reads sharedUrl from the current intent.
        // Simplest compile-safe approach: recreate content with new extras.
        recreate()
    }

    private fun extractSharedUrl(intent: Intent?): String? {
        if (intent == null) return null
        if (intent.action != Intent.ACTION_SEND) {
            return intent.getStringExtra(SHARED_URL_KEY)
        }
        if (intent.type?.startsWith("text/") != true) return null
        // Senders put the URL in EXTRA_TEXT; fall back to first URL-like token.
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            ?: intent.getStringExtra(Intent.EXTRA_SUBJECT)
            ?: return null
        return URL_REGEX.find(text)?.value ?: text.takeIf { it.isNotBlank() }
    }

    companion object {
        const val SHARED_URL_KEY = "shared_url"
        private val URL_REGEX = Regex("https?://[^\\s]+")
    }
}
