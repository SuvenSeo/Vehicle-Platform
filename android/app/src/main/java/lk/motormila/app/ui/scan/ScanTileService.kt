package lk.motormila.app.ui.scan

import android.app.PendingIntent
import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Quick-settings tile: "Scan plate" → opens the app's plate scanner deep link.
 *
 * Manifest (manifest owner — NOT this file):
 * ```xml
 * <service android:name="lk.motormila.app.ui.scan.ScanTileService"
 *     android:label="@string/tile_scan"
 *     android:permission="android.permission.BIND_QUICK_SETTINGS_TILE"
 *     android:exported="true">
 *     <intent-filter>
 *         <action android:name="android.service.quicksettings.action.QS_TILE" />
 *     </intent-filter>
 * </service>
 * ```
 */
class ScanTileService : TileService() {

    override fun onStartListening() {
        qsTile?.let { tile ->
            tile.label = "Scan plate"
            tile.state = Tile.STATE_ACTIVE
            // System icon keeps this file resource-free; foundation may swap to R.drawable.ic_scan.
            tile.icon = Icon.createWithResource(this, android.R.drawable.ic_menu_camera)
            tile.updateTile()
        }
    }

    // Lint-safe: the Intent overload only ever runs below API 34 (see branch).
    @SuppressLint("StartActivityAndCollapseDeprecated")
    override fun onClick() {
        unlockAndRun {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("motormila://scan")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            // Intent variant throws on API 34+ (we target 35); PendingIntent
            // variant needs API 34, so branch at runtime.
            if (Build.VERSION.SDK_INT >= 34) {
                val pending = PendingIntent.getActivity(
                    this, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                runCatching { startActivityAndCollapse(pending) }
            } else {
                @Suppress("DEPRECATION")
                runCatching { startActivityAndCollapse(intent) }
            }
        }
    }
}
