package lk.motormila.app.core.motion

import android.provider.Settings
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * Reduced-motion support. Returns true when the user disabled animations
 * (Animator duration scale == 0) so flashing/shake/confetti/skeleton shimmer
 * must render as static states instead.
 */
@Composable
fun rememberReducedMotion(): Boolean {
    val context = LocalContext.current
    return remember {
        runCatching {
            Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1f,
            ) == 0f
        }.getOrDefault(false)
    }
}

/** Tween that snaps instantly when reduced motion is requested. */
@Composable
fun <T> motionSpec(reducedMotion: Boolean, durationMillis: Int = 300): FiniteAnimationSpec<T> =
    if (reducedMotion) snap() else tween(durationMillis)
