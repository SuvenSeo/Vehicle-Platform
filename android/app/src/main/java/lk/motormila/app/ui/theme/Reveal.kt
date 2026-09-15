package lk.motormila.app.ui.theme

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp

/**
 * Apple-style materialize: fade + 16dp rise, staggered by [delayMillis].
 * Skips entirely when the user has reduced motion enabled.
 */
fun Modifier.motormilaReveal(
    visible: Boolean = true,
    delayMillis: Int = 0,
    durationMillis: Int = 420,
): Modifier = composed {
    val reduce = ReduceMotion.current
    val progress = remember { Animatable(if (reduce || visible.not()) 1f else 0f) }
    LaunchedEffect(visible, reduce) {
        if (reduce) {
            progress.snapTo(1f)
            return@LaunchedEffect
        }
        if (visible) {
            progress.animateTo(
                1f,
                animationSpec = tween(
                    durationMillis = durationMillis,
                    delayMillis = delayMillis,
                    easing = AppleEasing,
                ),
            )
        } else {
            progress.snapTo(0f)
        }
    }
    val t = progress.value
    this
        .alpha(t)
        .offset(y = ((1f - t) * 16f).dp)
}
