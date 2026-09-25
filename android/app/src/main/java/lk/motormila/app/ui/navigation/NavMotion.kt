package lk.motormila.app.ui.navigation

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.VisibilityThreshold
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.ui.unit.IntOffset
import lk.motormila.app.ui.theme.AppleEasing

/** Fade duration for tab switches and as the opacity half of a push. */
internal const val NAV_FADE_MS = 180

/** Legacy name kept for tests / docs — push travel now uses [pushOffsetSpring]. */
internal const val NAV_SLIDE_MS = 320

/** Push enter: 12% of width from the trailing edge. */
internal const val NAV_PUSH_ENTER_FRACTION = 0.12f

/** Push exit: 8% of width toward the leading edge (parallax). */
internal const val NAV_PUSH_EXIT_FRACTION = 0.08f

internal fun pushOffsetSpring() = spring(
    dampingRatio = 0.86f,
    stiffness = 380f,
    visibilityThreshold = IntOffset.VisibilityThreshold,
)

internal fun tabScaleSpring() = spring<Float>(
    dampingRatio = 0.90f,
    stiffness = 500f,
)

fun motormilaEnterTransition(
    reducedMotion: Boolean,
    tabSwitch: Boolean,
): EnterTransition {
    if (reducedMotion) return fadeIn(tween(0))
    return if (tabSwitch) {
        fadeIn(tween(NAV_FADE_MS, easing = AppleEasing)) +
            scaleIn(initialScale = 0.985f, animationSpec = tabScaleSpring())
    } else {
        fadeIn(tween(NAV_FADE_MS, easing = AppleEasing)) +
            slideInHorizontally(
                animationSpec = pushOffsetSpring(),
                initialOffsetX = { (it * NAV_PUSH_ENTER_FRACTION).toInt() },
            )
    }
}

fun motormilaExitTransition(
    reducedMotion: Boolean,
    tabSwitch: Boolean,
): ExitTransition {
    if (reducedMotion) return fadeOut(tween(0))
    return if (tabSwitch) {
        fadeOut(tween(NAV_FADE_MS, easing = AppleEasing)) +
            scaleOut(targetScale = 1.015f, animationSpec = tabScaleSpring())
    } else {
        fadeOut(tween(NAV_FADE_MS, easing = AppleEasing)) +
            slideOutHorizontally(
                animationSpec = pushOffsetSpring(),
                targetOffsetX = { -(it * NAV_PUSH_EXIT_FRACTION).toInt() },
            )
    }
}

fun motormilaPopEnterTransition(
    reducedMotion: Boolean,
    tabSwitch: Boolean,
): EnterTransition {
    if (reducedMotion) return fadeIn(tween(0))
    return if (tabSwitch) {
        fadeIn(tween(NAV_FADE_MS, easing = AppleEasing))
    } else {
        fadeIn(tween(NAV_FADE_MS, easing = AppleEasing)) +
            slideInHorizontally(
                animationSpec = pushOffsetSpring(),
                initialOffsetX = { -(it * NAV_PUSH_EXIT_FRACTION).toInt() },
            )
    }
}

fun motormilaPopExitTransition(
    reducedMotion: Boolean,
    tabSwitch: Boolean,
): ExitTransition {
    if (reducedMotion) return fadeOut(tween(0))
    return if (tabSwitch) {
        fadeOut(tween(NAV_FADE_MS, easing = AppleEasing))
    } else {
        fadeOut(tween(NAV_FADE_MS, easing = AppleEasing)) +
            slideOutHorizontally(
                animationSpec = pushOffsetSpring(),
                targetOffsetX = { (it * NAV_PUSH_ENTER_FRACTION).toInt() },
            )
    }
}

fun isTabSwitch(
    initialRoute: String?,
    targetRoute: String?,
): Boolean = isTabNavRoute(initialRoute) && isTabNavRoute(targetRoute)
