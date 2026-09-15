package lk.motormila.app.ui.splash

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.ui.components.BrandLogo
import lk.motormila.app.ui.components.BrandLogoSize
import lk.motormila.app.ui.theme.AppleEasing
import lk.motormila.app.ui.theme.MotormilaSecondaryText

@Composable
fun SplashScreen(
    onDone: () -> Unit,
) {
    val reduced = rememberReducedMotion()
    val mark = remember { Animatable(if (reduced) 1f else 0.86f) }
    val copy = remember { Animatable(if (reduced) 1f else 0f) }

    LaunchedEffect(Unit) {
        if (!reduced) {
            mark.animateTo(1f, tween(720, easing = AppleEasing))
            copy.animateTo(1f, tween(420, easing = AppleEasing))
            delay(380)
        } else {
            delay(180)
        }
        onDone()
    }

    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .scale(mark.value)
                .alpha(0.4f + mark.value * 0.6f)
                .padding(horizontal = 32.dp),
        ) {
            BrandLogo(
                size = BrandLogoSize.LARGE,
                showWordmark = true,
                showTagline = true,
                showLiveIndicator = true,
            )
            Spacer(Modifier.height(18.dp))
            Text(
                text = "The fair mila for every motor.",
                color = MotormilaSecondaryText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.alpha(copy.value),
            )
        }
    }
}
