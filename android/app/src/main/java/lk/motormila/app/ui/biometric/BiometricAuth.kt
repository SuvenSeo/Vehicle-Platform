package lk.motormila.app.ui.biometric

import android.annotation.SuppressLint
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * Foundation-owned biometric host wiring.
 *
 * Returns the `(onSuccess, onError) -> Unit` verifier that [LoginScreen] and
 * [SettingsScreen] expect. Uses the framework [BiometricPrompt] (no extra
 * dependency); devices below API 29 get a graceful [onError] instead of a
 * crash. Per-attempt failures are silent (system UI retries); hard errors
 * surface via [onError].
 */
@SuppressLint("NewApi") // Guarded by SDK_INT check below.
@Composable
fun rememberBiometricAuth(
    title: String,
    subtitle: String? = null,
): (onSuccess: () -> Unit, onError: (String) -> Unit) -> Unit {
    val context = LocalContext.current
    return remember(context, title, subtitle) {
        { onSuccess, onError ->
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                onError("Biometric unlock needs Android 9 or newer")
            } else {
                val signal = CancellationSignal()
                val prompt = BiometricPrompt.Builder(context)
                    .setTitle(title)
                    .apply {
                        if (subtitle != null) setSubtitle(subtitle)
                        setNegativeButton(
                            "Cancel",
                            context.mainExecutor,
                        ) { _, _ -> signal.cancel() }
                    }
                    .build()
                prompt.authenticate(
                    signal,
                    context.mainExecutor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(
                            result: BiometricPrompt.AuthenticationResult?,
                        ) {
                            onSuccess()
                        }

                        override fun onAuthenticationError(
                            errorCode: Int,
                            errString: CharSequence?,
                        ) {
                            // User-cancelled: stay silent so screens don't flash errors.
                            if (errorCode == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED ||
                                errorCode == BiometricPrompt.BIOMETRIC_ERROR_CANCELED
                            ) {
                                return
                            }
                            onError(errString?.toString() ?: "Authentication error")
                        }
                    },
                )
            }
        }
    }
}
