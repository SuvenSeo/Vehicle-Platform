package lk.motormila.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Shimmer modifier: 1200ms sweep; static fill when reduced motion. */
fun Modifier.shimmer(enabled: Boolean = true): Modifier = composed {
    if (!enabled) {
        return@composed this.background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    }
    val transition = rememberInfiniteTransition(label = "shimmer")
    val offset by transition.animateFloat(
        initialValue = -1f,
        targetValue = 2f,
        animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing), RepeatMode.Restart),
        label = "shimmer-x",
    )
    var size = androidx.compose.runtime.remember { IntSize.Zero }
    this
        .onGloballyPositioned { size = it.size }
        .background(
            Brush.linearGradient(
                colors = listOf(
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
                ),
                start = Offset(size.width * offset, 0f),
                end = Offset(size.width * (offset + 0.35f), size.height.toFloat()),
            ),
        )
}

@Composable
fun LoadingSkeletonCard(modifier: Modifier = Modifier) {
    val reduced = rememberReducedMotion()
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(12.dp)
            .semantics { contentDescription = "Loading listing" },
    ) {
        Box(Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(12.dp)).shimmer(!reduced))
        Spacer(Modifier.height(10.dp))
        Box(Modifier.width(180.dp).height(16.dp).clip(RoundedCornerShape(6.dp)).shimmer(!reduced))
        Spacer(Modifier.height(6.dp))
        Box(Modifier.width(120.dp).height(14.dp).clip(RoundedCornerShape(6.dp)).shimmer(!reduced))
    }
}

@Composable
fun LoadingSkeletonRow(modifier: Modifier = Modifier) {
    val reduced = rememberReducedMotion()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .semantics { contentDescription = "Loading row" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(56.dp).clip(RoundedCornerShape(10.dp)).shimmer(!reduced))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Box(Modifier.width(160.dp).height(14.dp).clip(RoundedCornerShape(6.dp)).shimmer(!reduced))
            Spacer(Modifier.height(6.dp))
            Box(Modifier.width(100.dp).height(12.dp).clip(RoundedCornerShape(6.dp)).shimmer(!reduced))
        }
    }
}

@Composable
fun LoadingSkeletonChart(modifier: Modifier = Modifier) {
    val reduced = rememberReducedMotion()
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(180.dp)
            .clip(RoundedCornerShape(12.dp))
            .shimmer(!reduced)
            .semantics { contentDescription = "Loading chart" },
    )
}

@Composable
fun EmptyState(
    title: String,
    body: String,
    ctaLabel: String?,
    onCta: (() -> Unit)?,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Filled.SearchOff,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(4.dp))
        Text(body, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        if (ctaLabel != null && onCta != null) {
            Spacer(Modifier.height(16.dp))
            Button(onClick = onCta) { Text(ctaLabel) }
        }
    }
}

@Composable
fun ErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    cachedAvailable: Boolean = false,
    onShowCached: (() -> Unit)? = null,
    onLogin: (() -> Unit)? = null,
) {
    val isAuthError = message.contains("401", ignoreCase = true) ||
        message.contains("Unauthorized", ignoreCase = true) ||
        message.contains("Authentication", ignoreCase = true)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Filled.Refresh, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(12.dp))
        Text(if (isAuthError) "Session Required" else "Something went wrong", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Spacer(Modifier.height(4.dp))
        Text(
            if (isAuthError) "Sign in with your Motormila account to browse vehicle intelligence and market data." else message,
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        if (isAuthError && onLogin != null) {
            Button(onClick = onLogin) { Text("Sign in to Motormila") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onRetry) { Text("Retry") }
        } else {
            Button(onClick = onRetry) { Text("Retry") }
        }
        if (cachedAvailable && onShowCached != null) {
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onShowCached) { Text("Show cached results") }
        }
    }
}

/** Slide-down offline banner; static when reduced motion (no slide animation). */
@Composable
fun OfflineBanner(
    visible: Boolean,
    modifier: Modifier = Modifier,
) {
    if (!visible) return
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.secondaryContainer)
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .semantics { contentDescription = "Offline, showing cached data" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.WifiOff, contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            "Offline — showing cached data",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
        )
    }
}

/** Pulsing live dot; static dot when reduced motion. */
@Composable
fun LivePulse(modifier: Modifier = Modifier) {
    val reduced = rememberReducedMotion()
    val color = MaterialTheme.colorScheme.primary
    if (reduced) {
        Box(modifier.size(8.dp).background(color, CircleShape))
        return
    }
    val transition = rememberInfiniteTransition(label = "live-pulse")
    val alpha by transition.animateFloat(1f, 0.35f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "pulse")
    Box(
        modifier
            .size(8.dp)
            .background(color.copy(alpha = alpha), CircleShape)
            .semantics { contentDescription = "Live" },
    )
}
