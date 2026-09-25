@file:OptIn(ExperimentalSharedTransitionApi::class)

package lk.motormila.app.ui.navigation

import androidx.compose.animation.AnimatedContentScope
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavDeepLink
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable

val LocalSharedTransitionScope = staticCompositionLocalOf<SharedTransitionScope?> { null }

val LocalNavAnimatedVisibilityScope = staticCompositionLocalOf<AnimatedVisibilityScope?> { null }

fun listingHeroKey(listingId: Int): String = "listing-hero-$listingId"

/** Destination class name, stripping Navigation Compose args suffixes. */
fun navRouteBase(route: String?): String? {
    if (route.isNullOrBlank()) return null
    return route.substringBefore("/").substringBefore("?")
}

fun isTabNavRoute(route: String?): Boolean {
    if (route.isNullOrBlank()) return false
    val base = navRouteBase(route) ?: return false
    if (base in BOTTOM_BAR_ROUTES) return true
    return BOTTOM_BAR_ROUTES.any { tab -> route.startsWith(tab) }
}

inline fun <reified T : Any> NavGraphBuilder.motormilaComposable(
    deepLinks: List<NavDeepLink> = emptyList(),
    noinline content: @Composable AnimatedContentScope.(NavBackStackEntry) -> Unit,
) {
    composable<T>(deepLinks = deepLinks) {
        CompositionLocalProvider(LocalNavAnimatedVisibilityScope provides this) {
            content(it)
        }
    }
}
