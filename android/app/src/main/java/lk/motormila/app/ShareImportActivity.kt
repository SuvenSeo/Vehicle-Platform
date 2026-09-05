package lk.motormila.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import dagger.hilt.android.AndroidEntryPoint

/**
 * Transparent trampoline for ACTION_SEND text/plain.
 * Extracts the shared text and forwards it to [MainActivity] under
 * [MainActivity.SHARED_URL_KEY]; the nav graph routes to ShareImport.
 */
@AndroidEntryPoint
class ShareImportActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val sharedText = intent?.takeIf { it.action == Intent.ACTION_SEND }
            ?.getStringExtra(Intent.EXTRA_TEXT)
        val forward = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_SEND
            putExtra(MainActivity.SHARED_URL_KEY, sharedText)
        }
        startActivity(forward)
        finish()
    }
}
