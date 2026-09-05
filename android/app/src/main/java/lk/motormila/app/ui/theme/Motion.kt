package lk.motormila.app.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/** Apple smooth easing cubic (0.16, 1, 0.3, 1). */
val AppleEasing = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)

/** Emphasized easing cubic (0.05, 0.7, 0.1, 1). */
val EmphasizedEasing = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)

/** Standard Apple smooth tween: 300ms. */
fun <T> appleTween() = tween<T>(durationMillis = 300, easing = AppleEasing)

/** Standard emphasized tween: 350ms. */
fun <T> emphasizedTween() = tween<T>(durationMillis = 350, easing = EmphasizedEasing)

/** Snappy press feedback with natural Apple spring physics. */
fun <T> pressSpring() = spring<T>(
    dampingRatio = 0.72f,
    stiffness = 500f,
)

/** Bouncy fluid spring for micro-interactions (tabs, badges, hearts). */
fun <T> fluidSpring() = spring<T>(
    dampingRatio = 0.65f,
    stiffness = 380f,
)

/** Bottom-sheet entrance. */
fun <T> sheetSpring() = spring<T>(
    dampingRatio = 0.82f,
    stiffness = 180f,
)

/** Radar ring pulse. */
fun <T> ringSpring() = spring<T>(
    dampingRatio = 0.85f,
    stiffness = 120f,
)

object ReduceMotion {
    /**
     * True when the user disabled animations (Animator duration scale == 0).
     * Same signal as core.motion.rememberReducedMotion; duplicated here so the
     * theme module never touches the framework accessibility service directly.
     */
    val current: Boolean
        @Composable
        get() {
            val context = LocalContext.current
            return remember {
                runCatching {
                    android.provider.Settings.Global.getFloat(
                        context.contentResolver,
                        android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,
                        1f,
                    ) == 0f
                }.getOrDefault(false)
            }
        }
}

/** Shimmer sweep duration (skip when [ReduceMotion.current]). */
const val SHIMMER_MS = 1200

/** Soft pulse duration for live badges. */
const val PULSE_MS = 1600
