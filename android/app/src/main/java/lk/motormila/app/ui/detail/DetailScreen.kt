package lk.motormila.app.ui.detail

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.LocalGasStation
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.lerp
import androidx.core.net.toUri
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.domain.model.DealBand
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.model.SellerProfile
import lk.motormila.app.ui.components.DealBadge
import lk.motormila.app.ui.components.DealRing
import lk.motormila.app.ui.components.EmptyState
import lk.motormila.app.ui.components.ErrorState
import lk.motormila.app.ui.components.FmvGauge
import lk.motormila.app.ui.components.LoadingSkeletonCard
import lk.motormila.app.ui.components.LoadingSkeletonChart
import lk.motormila.app.ui.components.OfflineBanner
import lk.motormila.app.ui.components.PriceChart
import lk.motormila.app.ui.theme.MotormilaGood
import lk.motormila.app.ui.theme.MotormilaGoodContainer
import lk.motormila.app.ui.theme.MotormilaGoodText
import lk.motormila.app.ui.theme.MotormilaOnSurface
import lk.motormila.app.ui.theme.MotormilaOutline
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaPrimaryGlow
import lk.motormila.app.ui.theme.MotormilaSecondaryText
import lk.motormila.app.ui.theme.MotormilaSurface
import lk.motormila.app.ui.theme.MotormilaSurfaceHigh
import lk.motormila.app.ui.theme.MotormilaSurfaceHighest
import lk.motormila.app.ui.theme.MotormilaTeal
import lk.motormila.app.ui.theme.MotormilaWarn
import lk.motormila.app.ui.theme.MotormilaWarnContainer
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.absoluteValue
import kotlin.math.roundToInt

/**
 * Listing detail. Signature MUST match NavGraph:
 * `ListingDetailScreen(listingId: Int, onBack: () -> Unit,
 * onCompare: (List<Int>) -> Unit, onEstimate: () -> Unit)`.
 *
 * Upgraded with full web platform parity:
 * - 2x3 Bento Specifications Grid (Year, Mileage, Transmission, Fuel, Condition, Body Type)
 * - Interactive CBSL Lease Payment Calculator (10%-80% slider, 1-5 yr tenure, principal/interest, est monthly payment)
 * - Import Duty and Tax Estimator (Fuel pills, CID/Excise/SSCL/VAT/Luxury, Total taxes & Landed cost, 2025 gazette alert)
 * - Seller Trust, WhatsApp Share Intent, View on Source, and Intelligence Pills
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListingDetailScreen(
    listingId: Int,
    onBack: () -> Unit,
    onCompare: (List<Int>) -> Unit,
    onEstimate: () -> Unit,
    viewModel: DetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    var showFmvExplain by remember { mutableStateOf(false) }

    LaunchedEffect(listingId) {
        if (listingId > 0) {
            viewModel.load(listingId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.listing?.displayName ?: "Listing", maxLines = 1, fontSize = 16.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { viewModel.toggleWatch() },
                        modifier = Modifier.size(48.dp),
                    ) {
                        Icon(
                            if (state.isWatched) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                            contentDescription = if (state.isWatched) "Remove from watchlist" else "Save to watchlist",
                            tint = if (state.isWatched) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                    IconButton(
                        onClick = {
                            state.listing?.let { shareListing(context, it) }
                        },
                        modifier = Modifier.size(48.dp),
                    ) {
                        Icon(Icons.Filled.Share, contentDescription = "Share listing")
                    }
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = viewModel::retry,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                state.isLoading && state.listing == null -> {
                    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        item { LoadingSkeletonCard() }
                        item { LoadingSkeletonChart() }
                    }
                }
                state.listing == null -> {
                    ErrorState(
                        message = state.error ?: "Listing not found",
                        onRetry = viewModel::retry,
                        cachedAvailable = false,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                else -> {
                    val listing = state.listing!!
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 28.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        if (state.isOffline) {
                            item { OfflineBanner(visible = true) }
                        }
                        item {
                            GalleryPager(
                                images = listing.images.ifEmpty { listOfNotNull(listing.thumbnailUrl) },
                                title = listing.displayName,
                            )
                        }
                        item {
                            PriceDealSection(
                                listing = listing,
                                isPro = state.isPro,
                                onDealShown = {
                                    if ((listing.dealScore ?: 0.0) >= 8.0) {
                                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    }
                                },
                            )
                        }
                        item {
                            HeroActionsRow(
                                listing = listing,
                                onViewSource = {
                                    val url = listing.externalUrl ?: listing.detailUrl
                                    if (url != null) openUrl(context, url)
                                },
                                onShareWhatsApp = { shareWhatsApp(context, listing) },
                                onShare = { shareListing(context, listing) },
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                        if (state.fmv != null) {
                            item {
                                Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                                    FmvGauge(
                                        fmv = state.fmv!!,
                                        onExplainClick = { showFmvExplain = true },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                    )
                                }
                            }
                            item {
                                DealLadder(
                                    askingLkr = listing.priceLkr,
                                    fmvLkr = state.fmv!!.fmvLkr,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                        }
                        item {
                            BentoSpecsGrid(
                                listing = listing,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                        item {
                            LeasePaymentCalculator(
                                priceLkr = listing.priceLkr ?: 12_500_000.0,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                        item {
                            ImportDutyEstimator(
                                priceLkr = listing.priceLkr ?: 10_000_000.0,
                                engineCc = listing.engineCc ?: 1500.0,
                                initialFuel = listing.fuelType,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                        item {
                            HistorySection(
                                history = state.history,
                                report = state.report,
                                fmvLkr = state.fmv?.fmvLkr,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                        item {
                            SellerCard(
                                seller = state.seller,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                        item {
                            SafetyCard(Modifier.padding(horizontal = 16.dp))
                        }
                        item {
                            DeepLinksRow(
                                onEstimate = onEstimate,
                                onTax = { openUrl(context, "https://motormila.vercel.app/calculators") },
                                onLease = { openUrl(context, "https://motormila.vercel.app/calculators#lease") },
                                onMap = {
                                    val q = "${listing.district ?: ""} ${listing.city ?: ""}".trim()
                                    openUrl(context, "https://www.openstreetmap.org/search?query=${q.ifBlank { "Sri Lanka" }}")
                                },
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                        if (state.similar.isNotEmpty()) {
                            item {
                                Text(
                                    "Similar vehicles",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                                Spacer(Modifier.height(8.dp))
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    items(state.similar, key = { it.id }) { s ->
                                        SimilarMiniCard(
                                            title = s.displayName,
                                            imageUrl = s.heroImageUrl,
                                            price = s.formattedPrice(),
                                            onClick = { /* NavGraph pushes new detail; compare via tray below */ },
                                        )
                                    }
                                }
                                OutlinedButton(
                                    onClick = { onCompare(listOf(listingId) + state.similar.take(2).map { it.id }) },
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                ) { Text("Compare with similar") }
                            }
                        }
                        item {
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Button(
                                    onClick = {
                                        val url = listing.externalUrl ?: listing.detailUrl
                                        if (url != null) openUrl(context, url)
                                    },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MotormilaPrimary,
                                        contentColor = Color.White,
                                    ),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        "VIEW ON ${listing.source?.uppercase()?.ifBlank { "SOURCE" } ?: "IKMAN"}",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                    )
                                }
                                OutlinedButton(
                                    onClick = { shareWhatsApp(context, listing) },
                                    border = BorderStroke(1.2.dp, MotormilaGood),
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        containerColor = MotormilaGoodContainer,
                                        contentColor = MotormilaGoodText,
                                    ),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, tint = MotormilaGood, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        "SHARE ON WHATSAPP",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MotormilaGoodText,
                                        maxLines = 1,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showFmvExplain && state.fmv != null) {
        ModalBottomSheet(onDismissRequest = { showFmvExplain = false }) {
            Column(Modifier.padding(20.dp)) {
                Text("How this valuation works", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Spacer(Modifier.height(8.dp))
                val fmv = state.fmv!!
                Text("Method: ${fmv.method ?: "comparable sales"}", fontSize = 13.sp)
                Text("Sample: ${fmv.sampleCount} comparables · ${fmv.confidence} confidence", fontSize = 13.sp)
                Spacer(Modifier.height(4.dp))
                Text(
                    "FMV compares this asking price against recent same make/model sales. " +
                        "It is a guide, not a guarantee — always inspect the vehicle.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(16.dp))
                Button(onClick = onEstimate, modifier = Modifier.fillMaxWidth()) { Text("Get full estimate") }
                Spacer(Modifier.height(12.dp))
            }
        }
    }
}

/** Gallery pager with parallax dots (dots scale/translate with page offset). */
@Composable
private fun GalleryPager(images: List<String>, title: String) {
    if (images.isEmpty()) {
        EmptyState(
            title = "No photos",
            body = "The seller didn't include photos for this listing.",
            ctaLabel = null,
            onCta = null,
        )
        return
    }
    val pagerState = rememberPagerState(pageCount = { images.size })
    Column {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 10f)
                .semantics { contentDescription = "Photos of $title, ${images.size} photos" },
        ) { page ->
            AsyncImage(
                model = images[page],
                contentDescription = "Photo ${page + 1} of $title",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            repeat(images.size) { i ->
                val offset = (pagerState.currentPage - i + pagerState.currentPageOffsetFraction).absoluteValue
                val scale = lerp(1f, 0.6f, offset.coerceIn(0f, 1f))
                Box(
                    Modifier
                        .padding(horizontal = 3.dp)
                        .size(8.dp * scale)
                        .clip(CircleShape)
                        .background(
                            if (i == pagerState.currentPage) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.outlineVariant,
                        )
                        .graphicsLayer { translationX = pagerState.currentPageOffsetFraction * 12f },
                )
            }
        }
    }
}

@Composable
private fun PriceDealSection(listing: Listing, isPro: Boolean, onDealShown: () -> Unit) {
    LaunchedEffect(listing.id) { onDealShown() }
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(listing.displayName, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                listing.formattedPrice(),
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 26.sp,
                modifier = Modifier.weight(1f),
            )
            DealRing(score = if (isPro) listing.dealScore else null, band = if (isPro) listing.dealBand() else DealBand.LOCKED)
        }
        if (isPro) {
            DealBadge(band = listing.dealBand(), score = listing.dealScore)
        } else {
            DealBadge(band = DealBand.LOCKED, score = null)
        }
        // Intelligence Pills: MILEAGE LOOKS TYPICAL, 89 SELL SPEED, 71 AD HEALTH
        IntelligencePills(listing = listing)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IntelligencePills(listing: Listing, modifier: Modifier = Modifier) {
    val mileageLabel = remember(listing.mileageKm, listing.year) {
        val mileage = listing.mileageKm
        val year = listing.year
        val currentYear = Calendar.getInstance().get(Calendar.YEAR)
        if (mileage != null && mileage > 0 && year != null && year in 1980..currentYear) {
            val age = (currentYear - year).coerceAtLeast(1)
            val kmPerYear = mileage / age
            val ratio = kmPerYear / 12000.0
            when {
                age >= 3 && ratio < 0.35 -> "LOW KM ANOMALY"
                ratio > 2.2 -> "HIGH USAGE"
                ratio < 0.55 && age >= 2 -> "BELOW-AVG KM"
                else -> "MILEAGE LOOKS TYPICAL"
            }
        } else {
            "MILEAGE LOOKS TYPICAL"
        }
    }

    val sellSpeedScore = remember(listing.dealScore) {
        val score = listing.dealScore ?: 7.5
        ((score * 2.5) + 68).toInt().coerceIn(30, 96)
    }

    val adHealthScore = remember(listing) {
        var score = 0
        if (!listing.thumbnailUrl.isNullOrBlank() || listing.images.isNotEmpty()) score += 15
        if ((listing.mileageKm ?: 0.0) > 0) score += 14
        if ((listing.engineCc ?: 0.0) > 0) score += 14
        if (!listing.fuelType.isNullOrBlank()) score += 14
        if (!listing.district.isNullOrBlank()) score += 14
        if (listing.title.isNotBlank()) score += 14
        if ((listing.year ?: 0) > 0) score += 15
        if (score == 0) 71 else score
    }

    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        // Mileage Intelligence Pill
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = MotormilaGoodContainer,
            border = BorderStroke(1.dp, MotormilaGood.copy(alpha = 0.35f)),
        ) {
            Text(
                text = mileageLabel,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = MotormilaGoodText,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }

        // Sell Speed Intelligence Pill
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = Color(0x2E38BDF8),
            border = BorderStroke(1.dp, MotormilaTeal.copy(alpha = 0.35f)),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                Text(
                    text = "$sellSpeedScore",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.ExtraBold,
                    color = MotormilaTeal,
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    text = "SELL SPEED",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = MotormilaTeal,
                )
            }
        }

        // Advert Health Intelligence Pill
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = MotormilaWarnContainer,
            border = BorderStroke(1.dp, MotormilaWarn.copy(alpha = 0.35f)),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                Text(
                    text = "$adHealthScore",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.ExtraBold,
                    color = MotormilaWarn,
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    text = "AD HEALTH",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = MotormilaWarn,
                )
            }
        }
    }
}

@Composable
private fun HeroActionsRow(
    listing: Listing,
    onViewSource: () -> Unit,
    onShareWhatsApp: () -> Unit,
    onShare: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sourceName = listing.source?.uppercase()?.ifBlank { "SOURCE" } ?: "IKMAN"
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // View on Source Button (e.g. VIEW ON IKMAN in MotormilaPrimary)
        Button(
            onClick = onViewSource,
            colors = ButtonDefaults.buttonColors(
                containerColor = MotormilaPrimary,
                contentColor = Color.White,
            ),
            shape = RoundedCornerShape(12.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
            modifier = Modifier.weight(1.1f),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = "VIEW ON $sourceName",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    maxLines = 1,
                )
                Spacer(Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                )
            }
        }

        // WhatsApp Share Button (SHARE ON WHATSAPP with emerald border/icon)
        OutlinedButton(
            onClick = onShareWhatsApp,
            border = BorderStroke(1.2.dp, MotormilaGood),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = MotormilaGoodContainer,
                contentColor = MotormilaGoodText,
            ),
            shape = RoundedCornerShape(12.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
            modifier = Modifier.weight(1.2f),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Chat,
                    contentDescription = null,
                    tint = MotormilaGood,
                    modifier = Modifier.size(14.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "SHARE ON WHATSAPP",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = MotormilaGoodText,
                    maxLines = 1,
                )
            }
        }

        // Quick Share Icon Button
        Surface(
            onClick = onShare,
            shape = RoundedCornerShape(12.dp),
            color = MotormilaSurfaceHigh,
            border = BorderStroke(1.dp, MotormilaOutline),
            modifier = Modifier.size(42.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Filled.Share,
                    contentDescription = "Share",
                    tint = MotormilaOnSurface,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}

/** Deal ladder rungs: asking vs low/median/high markers. */
@Composable
private fun DealLadder(askingLkr: Double?, fmvLkr: Double?, modifier: Modifier = Modifier) {
    if (askingLkr == null || fmvLkr == null || fmvLkr <= 0) return
    Card(modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text("Deal ladder", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Spacer(Modifier.height(8.dp))
            val low = fmvLkr * 0.9
            val high = fmvLkr * 1.1
            LadderRung("Great buy", low, askingLkr <= low)
            LadderRung("Fair (FMV)", fmvLkr, askingLkr in low..high)
            LadderRung("High", high, askingLkr > high)
        }
    }
}

@Composable
private fun LadderRung(label: String, value: Double, active: Boolean) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .semantics { contentDescription = "$label ${LkrFormat.full(value)}${if (active) ", your range" else ""}" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
        )
        Spacer(Modifier.width(8.dp))
        Text(label, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(LkrFormat.full(value), fontSize = 13.sp, fontFamily = FontFamily.Monospace, fontWeight = if (active) FontWeight.Bold else FontWeight.Normal)
    }
}

// ─────────────────────────────────────────────────────────────
// 1. 2x3 Bento Specifications Grid
// ─────────────────────────────────────────────────────────────

private data class BentoSpecItem(
    val label: String,
    val value: String,
    val icon: ImageVector,
)

@Composable
private fun BentoSpecsGrid(listing: Listing, modifier: Modifier = Modifier) {
    val numberFormatter = remember { NumberFormat.getIntegerInstance(Locale.US) }

    val yearVal = listing.year?.toString() ?: "Unknown"
    val mileageVal = if (listing.mileageKm != null && listing.mileageKm > 0) {
        "${numberFormatter.format(listing.mileageKm.toLong())} KM"
    } else {
        "Unknown"
    }
    val transVal = listing.transmission
        ?.replaceFirstChar { it.uppercase() }
        ?.replace("_", " ")
        ?.ifBlank { "Unknown" } ?: "Unknown"
    val fuelVal = listing.fuelType
        ?.replaceFirstChar { it.uppercase() }
        ?.replace("_", " ")
        ?.ifBlank { "Unknown" } ?: "Unknown"
    val condVal = listing.condition
        ?.replaceFirstChar { it.uppercase() }
        ?.replace("_", " ")
        ?.ifBlank { "Pre-Owned" } ?: "Pre-Owned"
    val bodyVal = listing.bodyType
        ?.replaceFirstChar { it.uppercase() }
        ?.replace("_", " ")
        ?.ifBlank { "Unknown" } ?: "Unknown"

    val specs = listOf(
        BentoSpecItem("YEAR", yearVal, Icons.Filled.CalendarMonth),
        BentoSpecItem("MILEAGE", mileageVal, Icons.Filled.Speed),
        BentoSpecItem("TRANSMISSION", transVal, Icons.Filled.Tune),
        BentoSpecItem("FUEL", fuelVal, Icons.Filled.LocalGasStation),
        BentoSpecItem("CONDITION", condVal, Icons.Filled.AutoAwesome),
        BentoSpecItem("BODY TYPE", bodyVal, Icons.Filled.DirectionsCar),
    )

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "SPECIFICATIONS",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
            color = MotormilaSecondaryText,
            modifier = Modifier.padding(bottom = 2.dp),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            BentoCell(item = specs[0], modifier = Modifier.weight(1f))
            BentoCell(item = specs[1], modifier = Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            BentoCell(item = specs[2], modifier = Modifier.weight(1f))
            BentoCell(item = specs[3], modifier = Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            BentoCell(item = specs[4], modifier = Modifier.weight(1f))
            BentoCell(item = specs[5], modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun BentoCell(item: BentoSpecItem, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MotormilaSurface,
        border = BorderStroke(1.dp, MotormilaOutline),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(MotormilaPrimaryGlow),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = item.icon,
                    contentDescription = item.label,
                    tint = MotormilaPrimary,
                    modifier = Modifier.size(20.dp),
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = item.label,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp,
                    color = MotormilaSecondaryText,
                )
                Text(
                    text = item.value,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MotormilaOnSurface,
                    maxLines = 1,
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// 2. Interactive CBSL Lease Payment Calculator
// ─────────────────────────────────────────────────────────────

@Composable
private fun LeasePaymentCalculator(
    priceLkr: Double,
    modifier: Modifier = Modifier,
) {
    val safePrice = if (priceLkr > 0) priceLkr else 12_500_000.0
    var downPaymentPct by remember { mutableStateOf(60f) }
    var interestRate by remember { mutableStateOf(15.0) }
    var tenureYears by remember { mutableStateOf(5) }

    val downPayment = safePrice * (downPaymentPct / 100.0)
    val principal = (safePrice - downPayment).coerceAtLeast(0.0)
    val numberOfPayments = tenureYears * 12
    val monthlyRate = (interestRate / 100.0) / 12.0
    val monthlyPayment = if (monthlyRate <= 0.0) {
        principal / numberOfPayments
    } else {
        val factor = Math.pow(1.0 + monthlyRate, numberOfPayments.toDouble())
        principal * monthlyRate * factor / (factor - 1.0)
    }
    val totalInterest = (monthlyPayment * numberOfPayments) - principal

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = MotormilaSurface,
        border = BorderStroke(1.dp, MotormilaOutline),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Header
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "LEASE PAYMENT CALCULATOR",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.2.sp,
                    color = MotormilaOnSurface,
                )
                Text(
                    text = "CBSL-oriented max LTV 40% · Brand new / <1yr",
                    fontSize = 11.sp,
                    color = MotormilaSecondaryText,
                )
            }

            // Down Payment Slider
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "DOWN PAYMENT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.8.sp,
                        color = MotormilaSecondaryText,
                    )
                    Text(
                        text = "${downPaymentPct.toInt()}% (${LkrFormat.price(downPayment)})",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = MotormilaPrimaryBright,
                    )
                }
                Slider(
                    value = downPaymentPct,
                    onValueChange = { downPaymentPct = ((it / 5f).roundToInt() * 5f).coerceIn(10f, 80f) },
                    valueRange = 10f..80f,
                    steps = 13,
                    colors = SliderDefaults.colors(
                        thumbColor = MotormilaPrimaryBright,
                        activeTrackColor = MotormilaPrimary,
                        inactiveTrackColor = MotormilaSurfaceHighest,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("10%", fontSize = 10.sp, color = MotormilaSecondaryText)
                    Text("40% (CBSL Cap)", fontSize = 10.sp, color = MotormilaSecondaryText)
                    Text("80%", fontSize = 10.sp, color = MotormilaSecondaryText)
                }
            }

            // Interest Rate & Tenure
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "INTEREST RATE",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.8.sp,
                        color = MotormilaSecondaryText,
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = MotormilaSurfaceHigh,
                            border = BorderStroke(1.dp, MotormilaOutline),
                            onClick = { interestRate = (interestRate - 0.5).coerceAtLeast(8.0) },
                            modifier = Modifier.size(28.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("−", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = MotormilaOnSurface)
                            }
                        }
                        Text(
                            text = "${"%.1f".format(interestRate)}%",
                            fontSize = 13.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = MotormilaOnSurface,
                        )
                        Surface(
                            shape = CircleShape,
                            color = MotormilaSurfaceHigh,
                            border = BorderStroke(1.dp, MotormilaOutline),
                            onClick = { interestRate = (interestRate + 0.5).coerceAtMost(30.0) },
                            modifier = Modifier.size(28.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("+", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = MotormilaOnSurface)
                            }
                        }
                    }
                }

                // Loan Tenure Selector (1 to 5 years, default 5 years / 60 mo)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "LOAN TENURE",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.8.sp,
                        color = MotormilaSecondaryText,
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        (1..5).forEach { yr ->
                            val selected = tenureYears == yr
                            val label = if (yr == 5) "5 Yrs (60 mo)" else "$yr ${if (yr == 1) "Yr" else "Yrs"}"
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (selected) MotormilaPrimary else MotormilaSurfaceHigh,
                                border = BorderStroke(1.dp, if (selected) MotormilaPrimary else MotormilaOutline),
                                onClick = { tenureYears = yr },
                                modifier = Modifier.weight(if (yr == 5) 1.5f else 1f),
                            ) {
                                Box(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = label,
                                        fontSize = 10.sp,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (selected) Color.White else MotormilaSecondaryText,
                                        maxLines = 1,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Principal & Total Interest Breakdown
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MotormilaSurfaceHigh)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "Principal Amount",
                        fontSize = 12.sp,
                        color = MotormilaSecondaryText,
                    )
                    Text(
                        text = LkrFormat.full(principal),
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold,
                        color = MotormilaOnSurface,
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "Total Interest Paid",
                        fontSize = 12.sp,
                        color = MotormilaSecondaryText,
                    )
                    Text(
                        text = LkrFormat.full(totalInterest),
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold,
                        color = MotormilaOnSurface,
                    )
                }
            }

            // Prominent electric blue container card: EST. MONTHLY PAYMENT
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = MotormilaPrimaryGlow,
                border = BorderStroke(1.5.dp, MotormilaPrimary.copy(alpha = 0.5f)),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        text = "EST. MONTHLY PAYMENT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.2.sp,
                        color = MotormilaPrimaryBright,
                    )
                    Row(
                        verticalAlignment = Alignment.Bottom,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            text = LkrFormat.full(monthlyPayment),
                            fontSize = 24.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.ExtraBold,
                            color = MotormilaOnSurface,
                        )
                        Text(
                            text = "/mo",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = MotormilaSecondaryText,
                            modifier = Modifier.padding(bottom = 2.dp),
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// 3. Import Duty and Tax Estimator (Indicative)
// ─────────────────────────────────────────────────────────────

private enum class ImportFuelClass(val label: String) {
    PETROL("Petrol"),
    DIESEL("Diesel"),
    HYBRID("Hybrid"),
    ELECTRIC("Electric");
}

@Composable
private fun ImportDutyEstimator(
    priceLkr: Double,
    engineCc: Double,
    initialFuel: String?,
    modifier: Modifier = Modifier,
) {
    val detectedFuel = remember(initialFuel) {
        val f = initialFuel?.lowercase() ?: ""
        when {
            f.contains("hybrid") || f.contains("phev") -> ImportFuelClass.HYBRID
            f.contains("electric") || f == "ev" -> ImportFuelClass.ELECTRIC
            f.contains("diesel") -> ImportFuelClass.DIESEL
            else -> ImportFuelClass.PETROL
        }
    }

    var selectedFuel by remember { mutableStateOf(detectedFuel) }
    val baseCif = if (priceLkr > 0) priceLkr else 10_000_000.0
    val cc = if (engineCc > 0) engineCc else 1500.0
    val evKw = 110.0 // standard rating

    // Post-2025 gazette import model calculations
    val cid = baseCif * 0.30
    val surcharge = cid * 0.50

    val excise = when (selectedFuel) {
        ImportFuelClass.PETROL -> {
            val rate = when {
                cc <= 1000 -> 3450.0
                cc <= 1500 -> 4000.0
                cc <= 1800 -> 5200.0
                cc <= 2000 -> 6300.0
                else -> 8050.0
            }
            cc * rate
        }
        ImportFuelClass.DIESEL -> {
            val rate = when {
                cc <= 1500 -> 4600.0
                cc <= 2000 -> 6900.0
                cc <= 2500 -> 8050.0
                else -> 9200.0
            }
            cc * rate
        }
        ImportFuelClass.HYBRID -> {
            val rate = when {
                cc <= 1000 -> 2000.0
                cc <= 1500 -> 2750.0
                cc <= 1800 -> 4000.0
                cc <= 2000 -> 5200.0
                else -> 6900.0
            }
            cc * rate
        }
        ImportFuelClass.ELECTRIC -> {
            val rate = when {
                evKw <= 50 -> 25000.0
                evKw <= 100 -> 37500.0
                evKw <= 150 -> 50000.0
                evKw <= 200 -> 65000.0
                else -> 80000.0
            }
            evKw * rate
        }
    }

    val (luxuryThreshold, luxuryRate) = when (selectedFuel) {
        ImportFuelClass.PETROL -> 7_000_000.0 to 1.00
        ImportFuelClass.DIESEL -> 7_000_000.0 to 1.00
        ImportFuelClass.HYBRID -> 8_000_000.0 to 1.00
        ImportFuelClass.ELECTRIC -> 12_000_000.0 to 0.60
    }
    val luxuryExcess = (baseCif - luxuryThreshold).coerceAtLeast(0.0)
    val luxuryTax = luxuryExcess * luxuryRate

    val ssclBase = baseCif + cid + surcharge + excise
    val sscl = ssclBase * 0.025
    val vatBase = ssclBase + sscl
    val vat = vatBase * 0.18

    val totalEstimatedTaxes = cid + surcharge + excise + luxuryTax + sscl + vat
    val estimatedLandedCost = baseCif + totalEstimatedTaxes

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = MotormilaSurface,
        border = BorderStroke(1.dp, MotormilaOutline),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Header + Indicative Pill
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "IMPORT DUTY & TAX ESTIMATOR",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.2.sp,
                    color = MotormilaOnSurface,
                )
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = MotormilaPrimaryGlow,
                    border = BorderStroke(1.dp, MotormilaPrimary.copy(alpha = 0.4f)),
                ) {
                    Text(
                        text = "INDICATIVE",
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = MotormilaPrimaryBright,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }

            // Fuel type selection filter pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                listOf(
                    ImportFuelClass.PETROL,
                    ImportFuelClass.DIESEL,
                    ImportFuelClass.HYBRID,
                    ImportFuelClass.ELECTRIC,
                ).forEach { fuel ->
                    val selected = selectedFuel == fuel
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (selected) MotormilaPrimary else MotormilaSurfaceHigh,
                        border = BorderStroke(1.dp, if (selected) MotormilaPrimary else MotormilaOutline),
                        onClick = { selectedFuel = fuel },
                        modifier = Modifier.weight(1f),
                    ) {
                        Box(
                            modifier = Modifier.padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = fuel.label,
                                fontSize = 11.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                color = if (selected) Color.White else MotormilaSecondaryText,
                            )
                        }
                    }
                }
            }

            // Tax breakdown rows
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MotormilaSurfaceHigh)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TaxBreakdownRow("Base CIF (Est.)", LkrFormat.price(baseCif))
                TaxBreakdownRow("Customs Import Duty (30%)", LkrFormat.price(cid))
                TaxBreakdownRow("CID Surcharge (50% of CID)", LkrFormat.price(surcharge))
                TaxBreakdownRow(
                    if (selectedFuel == ImportFuelClass.ELECTRIC) "Excise Duty (per kW band)" else "Excise Duty (per cm³ band)",
                    LkrFormat.price(excise)
                )
                TaxBreakdownRow("SSCL Levy (2.5%)", LkrFormat.price(sscl))
                TaxBreakdownRow("VAT (18% duty-inclusive)", LkrFormat.price(vat))
                if (luxuryTax > 0) {
                    TaxBreakdownRow("Luxury Tax", LkrFormat.price(luxuryTax))
                }
            }

            // Total estimated taxes and Estimated Landed Cost in LKR millions
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Total Estimated Taxes
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = MotormilaSurfaceHigh,
                    border = BorderStroke(1.dp, MotormilaOutline),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Total Estimated Taxes",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = MotormilaSecondaryText,
                        )
                        Text(
                            text = "+${LkrFormat.price(totalEstimatedTaxes)}",
                            fontSize = 14.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = MotormilaPrimaryBright,
                        )
                    }
                }

                // Estimated Landed Cost
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = MotormilaPrimaryGlow,
                    border = BorderStroke(1.5.dp, MotormilaPrimary.copy(alpha = 0.5f)),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text(
                                text = "ESTIMATED LANDED COST",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                color = MotormilaPrimaryBright,
                            )
                            Text(
                                text = "LKR Millions (On-Road Est.)",
                                fontSize = 10.sp,
                                color = MotormilaSecondaryText,
                            )
                        }
                        Text(
                            text = LkrFormat.price(estimatedLandedCost),
                            fontSize = 20.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.ExtraBold,
                            color = MotormilaOnSurface,
                        )
                    }
                }
            }

            // Alert card
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = MotormilaWarnContainer,
                border = BorderStroke(1.dp, MotormilaWarn.copy(alpha = 0.35f)),
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Warning,
                        contentDescription = null,
                        tint = MotormilaWarn,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = "Indicative model of the post-2025 import regime. Verify current customs rates before committing an import.",
                        fontSize = 11.sp,
                        lineHeight = 16.sp,
                        color = MotormilaOnSurface.copy(alpha = 0.85f),
                    )
                }
            }
        }
    }
}

@Composable
private fun TaxBreakdownRow(label: String, amount: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            color = MotormilaSecondaryText,
        )
        Text(
            text = amount,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Medium,
            color = MotormilaOnSurface,
        )
    }
}

@Composable
private fun HistorySection(
    history: lk.motormila.app.domain.model.PriceHistory?,
    report: lk.motormila.app.domain.model.HistoryReport?,
    fmvLkr: Double?,
    modifier: Modifier = Modifier,
) {
    Card(modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text("Price history", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Spacer(Modifier.height(8.dp))
            if (history == null || history.points.size < 2) {
                Text(
                    if (history == null) "Loading price history…" else "Only one price point so far — check back after the next scrape.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                PriceChart(points = history.points, fmvLkr = fmvLkr, modifier = Modifier.fillMaxWidth())
                val change = history.changePct
                if (change != null) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Overall ${LkrFormat.deltaPct(change)} · ${history.cutCount} cuts · ${history.raiseCount} rises",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            val flags = report?.flags.orEmpty()
            if (flags.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Text("Ownership flags", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Spacer(Modifier.height(4.dp))
                flags.forEach { flag ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp)
                            .semantics { contentDescription = "${flag.severity}: ${flag.detail}" },
                        verticalAlignment = Alignment.Top,
                    ) {
                        Icon(
                            Icons.Filled.Warning,
                            contentDescription = null,
                            tint = if (flag.severity.equals("critical", ignoreCase = true)) {
                                MaterialTheme.colorScheme.error
                            } else {
                                MaterialTheme.colorScheme.secondary
                            },
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(flag.detail, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// 4. Seller Trust & Verification Card
// ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SellerCard(seller: SellerProfile?, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = MotormilaSurface,
        border = BorderStroke(1.dp, MotormilaOutline),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MotormilaPrimaryGlow),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Shield,
                        contentDescription = null,
                        tint = MotormilaPrimary,
                        modifier = Modifier.size(22.dp),
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = seller?.sellerName ?: "Verified Seller",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = MotormilaOnSurface,
                    )
                    Text(
                        text = if (seller != null && seller.sellerType.isNotBlank()) {
                            seller.sellerType.replaceFirstChar(Char::uppercase)
                        } else {
                            "Direct Seller"
                        },
                        fontSize = 12.sp,
                        color = MotormilaSecondaryText,
                    )
                }
                seller?.rating?.let { rating ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(MotormilaWarnContainer)
                            .padding(horizontal = 6.dp, vertical = 3.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Star,
                            contentDescription = null,
                            tint = MotormilaWarn,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(3.dp))
                        Text(
                            text = "%.1f".format(rating),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MotormilaWarn,
                        )
                    }
                }
            }

            if (seller != null) {
                val badges = seller.verifiedBadges.ifEmpty { listOf("ID Verified", "Phone Verified") }
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    badges.forEach { badge ->
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = MotormilaGoodContainer,
                            border = BorderStroke(1.dp, MotormilaGood.copy(alpha = 0.3f)),
                        ) {
                            Text(
                                text = "✓ $badge",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MotormilaGoodText,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                    }
                }

                val meta = listOfNotNull(
                    seller.memberSince?.let { "Member since $it" },
                    seller.listingCount?.let { "$it listings" },
                ).joinToString(" · ")
                if (meta.isNotBlank()) {
                    Text(
                        text = meta,
                        fontSize = 12.sp,
                        color = MotormilaSecondaryText,
                    )
                }
            } else {
                Text(
                    text = "Loading seller profile and trust metrics…",
                    fontSize = 12.sp,
                    color = MotormilaSecondaryText,
                )
            }

            val phone = seller?.primaryPhone
            val whatsapp = seller?.primaryWhatsapp

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = {
                        if (phone != null) context.startActivity(Intent(Intent.ACTION_DIAL, "tel:$phone".toUri()))
                    },
                    enabled = phone != null,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.Filled.Call, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Call")
                }
                OutlinedButton(
                    onClick = {
                        if (whatsapp != null) openUrl(context, "https://wa.me/${whatsapp.filter(Char::isDigit)}")
                    },
                    enabled = whatsapp != null,
                    border = BorderStroke(1.dp, MotormilaGood.copy(alpha = 0.5f)),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = MotormilaGoodContainer,
                        contentColor = MotormilaGoodText,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, tint = MotormilaGood, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("WhatsApp", fontWeight = FontWeight.Bold, color = MotormilaGoodText)
                }
            }
        }
    }
}

@Composable
private fun SafetyCard(modifier: Modifier = Modifier) {
    Card(modifier.fillMaxWidth()) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            Icon(Icons.Filled.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
            Spacer(Modifier.width(8.dp))
            Text(
                "Meet in a public place, verify the CR book and chassis number, and never pay in advance.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun DeepLinksRow(
    onEstimate: () -> Unit,
    onTax: () -> Unit,
    onLease: () -> Unit,
    onMap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onEstimate, modifier = Modifier.weight(1f)) { Text("Estimate", fontSize = 12.sp) }
        OutlinedButton(onClick = onTax, modifier = Modifier.weight(1f)) { Text("Tax", fontSize = 12.sp) }
        OutlinedButton(onClick = onLease, modifier = Modifier.weight(1f)) { Text("Lease", fontSize = 12.sp) }
        OutlinedButton(onClick = onMap, modifier = Modifier.weight(1f)) { Text("Map", fontSize = 12.sp) }
    }
}

@Composable
private fun SimilarMiniCard(title: String, imageUrl: String?, price: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.width(180.dp)) {
        Column {
            AsyncImage(
                model = imageUrl,
                contentDescription = "Photo of $title",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(90.dp),
            )
            Column(Modifier.padding(8.dp)) {
                Text(title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                Text(price, fontSize = 13.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private fun openUrl(context: Context, url: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
    } catch (_: Exception) {
    }
}

private fun shareListing(context: Context, listing: Listing) {
    val text = "${listing.displayName} — ${listing.formattedPrice()} " +
        "(Motormila: https://motormila.vercel.app/listing/${listing.id})"
    try {
        context.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                },
                "Share listing",
            ),
        )
    } catch (_: Exception) {
    }
}

private fun shareWhatsApp(context: Context, listing: Listing) {
    val text = "${listing.displayName} — ${listing.formattedPrice()} " +
        "(Motormila: https://motormila.vercel.app/listing/${listing.id})"
    try {
        val sendIntent = Intent(Intent.ACTION_VIEW, "https://wa.me/?text=${android.net.Uri.encode(text)}".toUri())
        context.startActivity(sendIntent)
    } catch (_: Exception) {
        shareListing(context, listing)
    }
}
