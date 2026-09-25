package lk.motormila.app.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lk.motormila.app.R
import lk.motormila.app.ui.theme.MotormilaGood
import lk.motormila.app.ui.theme.MotormilaOutline
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaSecondaryText

enum class BrandLogoSize(
    val markSize: Dp,
    val textSize: TextUnit,
    val showTagline: Boolean,
) {
    COMPACT(markSize = 32.dp, textSize = 18.sp, showTagline = false),
    NAV(markSize = 38.dp, textSize = 20.sp, showTagline = false),
    DEFAULT(markSize = 44.dp, textSize = 22.sp, showTagline = true),
    LARGE(markSize = 56.dp, textSize = 28.sp, showTagline = true),
}

/**
 * Official Motormila Brand Lockup matching web platform `BrandLogo.tsx`.
 * Features the official rounded squircle mark, the high-contrast italicized
 * "Motor" + electric blue "mila" wordmark, and the market intelligence badge.
 */
@Composable
fun BrandLogo(
    modifier: Modifier = Modifier,
    size: BrandLogoSize = BrandLogoSize.NAV,
    showWordmark: Boolean = true,
    showTagline: Boolean = size.showTagline,
    tagline: String = "Sri Lanka Vehicle Market Intelligence",
    showLiveIndicator: Boolean = false,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Rounded squircle icon with subtle glass hairline ring
        Box(
            modifier = Modifier
                .size(size.markSize)
                .clip(RoundedCornerShape(size.markSize * 0.24f))
                .border(1.dp, MotormilaOutline, RoundedCornerShape(size.markSize * 0.24f)),
            contentAlignment = Alignment.Center,
        ) {
            Image(
                painter = painterResource(id = R.drawable.motormila_logo),
                contentDescription = "Motormila",
                modifier = Modifier.size(size.markSize),
            )
        }

        if (showWordmark) {
            Spacer(Modifier.width(10.dp))
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val wordmark = buildAnnotatedString {
                        withStyle(
                            SpanStyle(
                                color = Color.White,
                                fontWeight = FontWeight.ExtraBold,
                                fontStyle = FontStyle.Italic,
                                letterSpacing = (-0.045).sp,
                            ),
                        ) {
                            append("Motor")
                        }
                        withStyle(
                            SpanStyle(
                                color = MotormilaPrimary,
                                fontWeight = FontWeight.ExtraBold,
                                fontStyle = FontStyle.Italic,
                                letterSpacing = (-0.045).sp,
                            ),
                        ) {
                            append("mila")
                        }
                    }

                    Text(
                        text = wordmark,
                        fontSize = size.textSize,
                        lineHeight = size.textSize,
                    )

                    if (showLiveIndicator) {
                        Spacer(Modifier.width(8.dp))
                        MarketLivePill()
                    }
                }

                if (showTagline) {
                    Text(
                        text = tagline.uppercase(),
                        fontSize = 8.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.12.sp,
                        color = MotormilaSecondaryText,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
    }
}

/**
 * Pulsing emerald green live market pulse pill.
 */
@Composable
fun MarketLivePill(modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 0.85f,
        targetValue = 1.25f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulse-scale",
    )

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color(0x2E10B981))
            .border(0.5.dp, Color(0x5510B981), RoundedCornerShape(999.dp))
            .padding(horizontal = 7.dp, vertical = 2.5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .scale(scale)
                .clip(CircleShape)
                .background(MotormilaGood),
        )
        Spacer(Modifier.width(5.dp))
        Text(
            text = "LIVE",
            fontSize = 9.sp,
            fontWeight = FontWeight.ExtraBold,
            color = Color(0xFF6EE7B7),
            letterSpacing = 0.08.sp,
        )
    }
}
