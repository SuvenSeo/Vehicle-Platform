package lk.motormila.app.ui.navigation

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import lk.motormila.app.ui.theme.AppleEasing

internal const val NAV_FADE_MS = 220
internal const val NAV_SLIDE_MS = 320

fun motormilaEnterTransition(
    reducedMotion: Boolean,
    tabSwitch: Boolean,
): EnterTransition {
    if (reducedMotion) return fadeIn(tween(0))
    return if (tabSwitch) {
        fadeIn(tween(NAV_FADE_MS, easing = AppleEasing)) +
            scaleIn(initialScale = 0.98f, animationSpec = tween(NAV_FADE_MS, easing = AppleEasing))
    } else {
        fadeIn(tween(NAV_SLIDE_MS, easing = AppleEasing)) +
            slideInHorizontally(
                animationSpec = tween(NAV_SLIDE_MS, easing = AppleEasing),
                initialOffsetX = { it / 5 },
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
            scaleOut(targetScale = 1.02f, animationSpec = tween(NAV_FADE_MS, easing = AppleEasing))
    } else {
        fadeOut(tween(NAV_SLIDE_MS, easing = AppleEasing)) +
            slideOutHorizontally(
                animationSpec = tween(NAV_SLIDE_MS, easing = AppleEasing),
                targetOffsetX = { -it / 8 },
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
        fadeIn(tween(NAV_SLIDE_MS, easing = AppleEasing)) +
            slideInHorizontally(
                animationSpec = tween(NAV_SLIDE_MS, easing = AppleEasing),
                initialOffsetX = { -it / 8 },
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
        fadeOut(tween(NAV_SLIDE_MS, easing = AppleEasing)) +
            slideOutHorizontally(
                animationSpec = tween(NAV_SLIDE_MS, easing = AppleEasing),
                targetOffsetX = { it / 5 },
            )
    }
}

fun isTabSwitch(
    initialRoute: String?,
    targetRoute: String?,
): Boolean = isTabNavRoute(initialRoute) && isTabNavRoute(targetRoute)
