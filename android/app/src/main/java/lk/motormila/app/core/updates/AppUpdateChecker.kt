package lk.motormila.app.core.updates

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * In-app update checking for the sideload APK distribution channel.
 *
 * Flow: app calls GET {BASE_URL}/releases/app → backend returns env-published
 * metadata for the newest GitHub Release APK. If [LatestRelease.versionCode]
 * is greater than the running BuildConfig.VERSION_CODE the UI shows an
 * "Update available" dialog; tapping it downloads the APK and hands it to the
 * system package installer (user confirms — no silent install).
 *
 * Version comparison is numeric on versionCode (never versionName strings).
 * Every failure path yields "up to date" — the checker can never block usage.
 */
@Singleton
class AppUpdateChecker @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val json: Json,
) {

    @Serializable
    data class LatestRelease(
        val version: String? = null,
        val version_code: Int? = null,
        val apk_url: String? = null,
        val notes: String? = null,
        val published_at: String? = null,
        val min_supported_version_code: Int = 0,
    )

    sealed interface CheckResult {
        /** A newer build exists; fields are pre-decoded for the dialog. */
        data class UpdateAvailable(
            val versionName: String,
            val versionCode: Int,
            val apkUrl: String,
            val notes: String?,
        ) : CheckResult

        /** Running build is the newest (or check failed) — no action needed. */
        data object UpToDate : CheckResult
    }

    /**
     * Ask the backend for the newest release. Returns [CheckResult.UpdateAvailable]
     * only when the remote versionCode strictly exceeds the running one AND an
     * apk_url is present. Any network/parse error yields [CheckResult.UpToDate].
     */
    suspend fun check(currentVersionCode: Int): CheckResult {
        val release = fetchLatestRelease() ?: return CheckResult.UpToDate
        val remoteCode = release.version_code ?: return CheckResult.UpToDate
        val url = release.apk_url?.trim().orEmpty()
        if (remoteCode <= currentVersionCode || url.isBlank()) return CheckResult.UpToDate
        return CheckResult.UpdateAvailable(
            versionName = release.version ?: "v$remoteCode",
            versionCode = remoteCode,
            apkUrl = url,
            notes = release.notes?.takeIf { it.isNotBlank() },
        )
    }

    /**
     * Download the APK into app-external cache. Returns null on any failure —
     * the caller keeps the user in the app and surfaces a snackbar.
     */
    suspend fun downloadApk(apkUrl: String, context: Context): File? {
        return try {
            val request = Request.Builder().url(apkUrl).build()
            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body ?: return null
                val dir = File(context.getExternalFilesDir(null), "updates").apply { mkdirs() }
                val target = File(dir, "motormila-update.apk")
                target.outputStream().use { out ->
                    body.byteStream().use { input -> input.copyTo(out) }
                }
                if (target.length() == 0L) {
                    target.delete()
                    return null
                }
                target
            }
        } catch (_: IOException) {
            null
        } catch (_: SecurityException) {
            null
        }
    }

    /**
     * Hand the downloaded APK to the system installer. Requires the user to
     * have "Install unknown apps" enabled for this app (sideload channel).
     */
    fun launchInstaller(apkFile: File, context: Context): Boolean {
        return try {
            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile,
            )
            val intent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }

    private suspend fun fetchLatestRelease(): LatestRelease? {
        val url = buildReleaseUrl().toHttpUrlOrNull() ?: return null
        val request = Request.Builder().url(url).get().build()
        return try {
            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body ?: return null
                json.decodeFromString(LatestRelease.serializer(), body.string())
            }
        } catch (_: IOException) {
            null
        } catch (_: SerializationException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun buildReleaseUrl(): String =
        BuildConfig.BASE_URL.trim().trimEnd('/') + "/releases/app"
}
