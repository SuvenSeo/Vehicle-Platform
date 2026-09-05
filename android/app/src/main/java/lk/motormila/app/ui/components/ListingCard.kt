package lk.motormila.app.ui.components

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.domain.model.DealBand
import lk.motormila.app.domain.model.Listing

/**
 * 16dp card, 16:10 Coil image, source badge, 48dp heart with burst scale,
 * mono price + delta chip, [DealBadge]/[DealRing], meta line.
 * Press scale 0.97. [sharedElementModifier] is a placeholder the foundation
 * builder wires to shared-element transitions when available.
 */
@Composable
fun ListingCard(
    listing: Listing,
    isWatched: Boolean,
    onClick: () -> Unit,
    onWatchToggle: () -> Unit,
    modifier: Modifier = Modifier,
    showDeal: Boolean = true,
    sharedElementModifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val reducedMotion = rememberReducedMotion()
    val pressScale by animateFloatAsState(
        targetValue = if (pressed && !reducedMotion) 0.97f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "card-press",
    )
    val haptics = LocalHapticFeedback.current
    val watchScale by animateFloatAsState(
        targetValue = if (isWatched) 1.15f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMedium,
        ),
        label = "heart-burst",
    )
    val band = listing.dealBand()
    val delta = listing.deltaVsMedianPct()

    Card(
        modifier = modifier
            .fillMaxWidth()
            .scale(pressScale)
            .then(sharedElementModifier)
            .semantics { contentDescription = "${listing.displayName}, ${listing.formattedPrice()}" },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, lk.motormila.app.ui.theme.MotormilaOutline),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp, pressedElevation = 6.dp),
        onClick = onClick,
        interactionSource = interaction,
    ) {
        Column {
            Box {
                AsyncImage(
                    model = listing.heroImageUrl,
                    contentDescription = "Photo of ${listing.displayName}",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 10f)
                        .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)),
                )
                if (!listing.source.isNullOrBlank()) {
                    Text(
                        text = listing.source.uppercase(),
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(8.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xCC09090B))
                            .border(0.5.dp, Color(0x44FFFFFF), RoundedCornerShape(6.dp))
                            .padding(horizontal = 7.dp, vertical = 3.dp),
                    )
                }
                IconButton(
                    onClick = {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onWatchToggle()
                    },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(48.dp)
                        .semantics {
                            contentDescription = if (isWatched) "Remove from watchlist" else "Add to watchlist"
                        },
                ) {
                    Icon(
                        imageVector = if (isWatched) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = null,
                        tint = if (isWatched) MaterialTheme.colorScheme.error else Color.White,
                        modifier = Modifier.scale(if (reducedMotion) 1f else watchScale),
                    )
                }
            }
            Column(Modifier.padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = listing.displayName,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    if (showDeal && band == DealBand.LOCKED) {
                        DealBadge(band = band, score = null)
                    } else if (showDeal) {
                        DealRing(score = listing.dealScore, band = band)
                    }
                }
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = listing.formattedPrice(),
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (delta != null && band != DealBand.LOCKED) {
                        Spacer(Modifier.size(8.dp))
                        DeltaChip(deltaPct = delta)
                    }
                }
                if (showDeal && band != DealBand.LOCKED) {
                    Spacer(Modifier.height(6.dp))
                    DealBadge(band = band, score = listing.dealScore)
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    text = metaLine(listing),
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun DeltaChip(deltaPct: Double) {
    val down = deltaPct < 0
    val container = if (down) Color(0x2E10B981) else Color(0x2EEF4444)
    val content = if (down) Color(0xFF6EE7B7) else Color(0xFFFCA5A5)
    val border = if (down) Color(0x5510B981) else Color(0x55EF4444)
    Text(
        text = "${if (down) "▼" else "▲"} ${LkrFormat.deltaPct(deltaPct)}",
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = content,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(container)
            .border(0.5.dp, border, RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

private fun metaLine(l: Listing): String {
    val parts = mutableListOf<String>()
    l.year?.let { parts += it.toString() }
    l.mileageKm?.let { if (it > 0) parts += LkrFormat.km(it) }
    l.fuelType?.let { if (it.isNotBlank()) parts += it.replaceFirstChar(Char::uppercase) }
    l.transmission?.let { if (it.isNotBlank()) parts += it.replaceFirstChar(Char::uppercase) }
    listOfNotNull(l.district?.takeIf { it.isNotBlank() }, l.city?.takeIf { it.isNotBlank() })
        .joinToString(", ").takeIf { it.isNotBlank() }?.let { parts += it }
    return parts.joinToString(" · ").ifBlank { "Details on listing page" }
}
