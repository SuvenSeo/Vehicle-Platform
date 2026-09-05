package lk.motormila.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkScheme = darkColorScheme(
    background = MotormilaBg,
    surface = MotormilaSurface,
    surfaceContainerLowest = MotormilaBg,
    surfaceContainerLow = MotormilaSurfaceLow,
    surfaceContainer = MotormilaSurface,
    surfaceContainerHigh = MotormilaSurfaceHigh,
    surfaceContainerHighest = MotormilaSurfaceHighest,
    surfaceVariant = MotormilaSurfaceHigh,
    onSurface = MotormilaOnSurface,
    onSurfaceVariant = MotormilaSecondaryText,
    outline = MotormilaOutline,
    outlineVariant = MotormilaGlassBorder,
    primary = MotormilaPrimary,
    onPrimary = MotormilaOnPrimary,
    primaryContainer = MotormilaPrimaryGlow,
    onPrimaryContainer = MotormilaPrimaryBright,
    secondary = MotormilaTeal,
    onSecondary = MotormilaOnPrimary,
    secondaryContainer = Color(0x2E38BDF8),
    onSecondaryContainer = MotormilaTeal,
    tertiary = MotormilaSky,
    error = MotormilaBad,
    onError = MotormilaOnSurface,
    errorContainer = MotormilaBadContainer,
    onErrorContainer = Color(0xFFFCA5A5),
)

private val LightScheme = lightColorScheme(
    background = MotormilaLightBg,
    surface = MotormilaLightSurface,
    surfaceContainerLowest = MotormilaLightSurface,
    surfaceContainerLow = MotormilaLightContainer,
    surfaceContainer = MotormilaLightContainer,
    surfaceContainerHigh = MotormilaLightHigh,
    surfaceContainerHighest = MotormilaLightHigh,
    onSurface = MotormilaLightOnSurface,
    onSurfaceVariant = MotormilaLightVariant,
    outline = MotormilaLightOutline,
    outlineVariant = MotormilaLightOutline,
    primary = MotormilaLightPrimary,
    onPrimary = MotormilaLightOnPrimary,
    primaryContainer = MotormilaLightGoldContainer,
    onPrimaryContainer = MotormilaLightOnSurface,
    secondary = MotormilaLightPrimary,
    tertiary = MotormilaLightPrimary,
    error = MotormilaLightBad,
    onError = MotormilaLightSurface,
)

@Composable
fun MotormilaTheme(
    darkTheme: Boolean = true, // dark-first
    content: @Composable () -> Unit,
) {
    // dynamicColor deliberately false: brand tokens win over wallpaper tints.
    val scheme = if (darkTheme) DarkScheme else LightScheme
    val view = LocalView.current
    SideEffect {
        val window = (view.context as? Activity)?.window ?: return@SideEffect
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT
        WindowCompat.getInsetsController(window, view).apply {
            isAppearanceLightStatusBars = scheme == LightScheme
            isAppearanceLightNavigationBars = scheme == LightScheme
        }
    }
    MaterialTheme(
        colorScheme = scheme,
        typography = MotormilaTypography,
        content = content,
    )
}
