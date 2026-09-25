package lk.motormila.app.ui.theme

import android.view.HapticFeedbackConstants
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalView

/**
 * Central haptics wrapper so screens never touch the framework directly.
 */
class HapticHelper(private val perform: (Int) -> Unit) {
    fun tick() = perform(HapticFeedbackConstants.CLOCK_TICK)
    fun confirm() = perform(HapticFeedbackConstants.CONFIRM)
    fun reject() = perform(HapticFeedbackConstants.REJECT)
    fun longPress() = perform(HapticFeedbackConstants.LONG_PRESS)
    fun keypress() = perform(HapticFeedbackConstants.VIRTUAL_KEY)
}

@Composable
fun rememberHaptics(): HapticHelper {
    val view = LocalView.current
    return remember(view) {
        HapticHelper { constant -> view.performHapticFeedback(constant) }
    }
}
