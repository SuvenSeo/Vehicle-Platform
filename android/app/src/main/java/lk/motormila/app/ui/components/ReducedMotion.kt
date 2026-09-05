package lk.motormila.app.ui.components

import androidx.compose.runtime.Composable

/**
 * Re-export of the canonical reduced-motion flag for UI call sites.
 * True when the user disabled animations system-wide.
 */
@Composable
fun rememberReducedMotion(): Boolean =
    lk.motormila.app.core.motion.rememberReducedMotion()
