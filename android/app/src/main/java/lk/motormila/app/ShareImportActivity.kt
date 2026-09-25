package lk.motormila.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import dagger.hilt.android.AndroidEntryPoint

/**
 * Transparent trampoline for ACTION_SEND text/plain.
 * Extracts the shared text (EXTRA_TEXT → EXTRA_SUBJECT fallback, first URL
 * token preferred) and forwards it to [MainActivity] under
 * [MainActivity.SHARED_URL_KEY]; the nav graph routes to ShareImport.
 * Never crashes on empty/missing extras — forwards null and finishes.
 */
@AndroidEntryPoint
class ShareImportActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val raw = intent?.takeIf { it.action == Intent.ACTION_SEND }
            ?.let {
                it.getStringExtra(Intent.EXTRA_TEXT)
                    ?: it.getStringExtra(Intent.EXTRA_SUBJECT)
                    ?: it.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
            }
        val sharedText = raw?.let { URL_REGEX.find(it)?.value ?: it.takeIf { s -> s.isNotBlank() } }
        val forward = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_SEND
            type = "text/plain"
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra(MainActivity.SHARED_URL_KEY, sharedText)
        }
        startActivity(forward)
        finish()
    }

    companion object {
        private val URL_REGEX = Regex("https?://[^\\s]+")
    }
}
