package lk.motormila.app.ui.updates

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import lk.motormila.app.core.updates.AppUpdateChecker

/**
 * Owns the in-app update flow: one passive check per cold start, an optional
 * manual re-check, download + installer hand-off.
 *
 * Dismissal: "Later" hides the dialog and remembers that version code so the
 * passive launch check stays quiet, while an explicit manual check always
 * re-shows what's available. Failures are silent except the manual check,
 * which surfaces a "no update" confirmation.
 */
@HiltViewModel
class AppUpdateViewModel @Inject constructor(
    private val updateChecker: AppUpdateChecker,
    @ApplicationContext private val appContext: Context,
) : ViewModel() {

    data class UiState(
        val checking: Boolean = false,
        val downloading: Boolean = false,
        val available: AppUpdateChecker.CheckResult.UpdateAvailable? = null,
        val dismissedVersionCode: Int? = null,
        val downloadFailedTick: Int = 0,
        val manuallyCheckedWithNoUpdate: Boolean = false,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var checkedThisProcess = false

    /** Passive check at app start — never shows "no update" feedback. */
    fun checkOnLaunch(currentVersionCode: Int) {
        if (checkedThisProcess) return
        checkedThisProcess = true
        runCheck(currentVersionCode, isManual = false)
    }

    /** Explicit "Check for updates" action — surfaces result feedback. */
    fun manualCheck(currentVersionCode: Int) {
        runCheck(currentVersionCode, isManual = true)
    }

    fun consumeNoUpdateFeedback() {
        _state.value = _state.value.copy(manuallyCheckedWithNoUpdate = false)
    }

    fun consumeDownloadFailure() {
        _state.value = _state.value.copy(downloadFailedTick = 0)
    }

    /** "Later" — quiet for this version on passive checks. */
    fun dismiss() {
        val current = _state.value
        _state.value = current.copy(
            available = null,
            dismissedVersionCode = current.available?.versionCode,
        )
    }

    fun downloadAndInstall(update: AppUpdateChecker.CheckResult.UpdateAvailable) {
        if (_state.value.downloading) return
        _state.value = _state.value.copy(downloading = true)
        viewModelScope.launch {
            val apk = updateChecker.downloadApk(update.apkUrl, appContext)
            _state.value = _state.value.copy(downloading = false)
            if (apk != null) {
                withContext(Dispatchers.Main) { updateChecker.launchInstaller(apk, appContext) }
            } else {
                _state.value = _state.value.copy(downloadFailedTick = _state.value.downloadFailedTick + 1)
            }
        }
    }

    private fun runCheck(currentVersionCode: Int, isManual: Boolean) {
        if (_state.value.checking) return
        _state.value = _state.value.copy(checking = true)
        viewModelScope.launch {
            val result = updateChecker.check(currentVersionCode)
            val current = _state.value
            _state.value = when (result) {
                is AppUpdateChecker.CheckResult.UpdateAvailable ->
                    // Manual checks always re-show; passive checks respect dismissal.
                    if (!isManual && current.dismissedVersionCode == result.versionCode) {
                        current.copy(checking = false)
                    } else {
                        current.copy(checking = false, available = result)
                    }
                AppUpdateChecker.CheckResult.UpToDate -> current.copy(
                    checking = false,
                    manuallyCheckedWithNoUpdate = isManual,
                )
            }
        }
    }
}
