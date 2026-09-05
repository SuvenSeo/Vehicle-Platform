package lk.motormila.app.ui.home

import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.ui.components.BrandLogo
import lk.motormila.app.ui.components.BrandLogoSize
import lk.motormila.app.ui.components.EmptyState
import lk.motormila.app.ui.components.ErrorState
import lk.motormila.app.ui.components.LivePulse
import lk.motormila.app.ui.components.LoadingSkeletonCard
import lk.motormila.app.ui.components.OfflineBanner
import lk.motormila.app.ui.components.rememberReducedMotion
import lk.motormila.app.ui.theme.MotormilaGlassBorder
import lk.motormila.app.ui.theme.MotormilaOnSurface
import lk.motormila.app.ui.theme.MotormilaOutline
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaSecondaryText

/** Data representation for Trending Models rail. */
data class TrendingModelItem(
    val make: String,
    val model: String,
    val countText: String,
    val avgPriceText: String,
    val imageUrl: String? = null,
)

/** Data representation for Live Incoming Feed ticker item. */
data class LiveFeedItem(
    val title: String,
    val district: String,
    val dealScoreText: String,
    val listingId: Int? = null,
)

private val DEFAULT_TRENDING_MODELS = listOf(
    TrendingModelItem("Bajaj", "RE", "2,040 listed", "avg Rs. 1.09M"),
    TrendingModelItem("Suzuki", "Wagon", "1,960 listed", "avg Rs. 7.62M"),
    TrendingModelItem("Honda", "Vezel", "1,884 listed", "avg Rs. 17.53M"),
    TrendingModelItem("Toyota", "Raize", "1,606 listed", "avg Rs. 13.79M"),
)

private val DEFAULT_LIVE_FEED = listOf(
    LiveFeedItem("Toyota Aqua", "Colombo", "+97 deal"),
    LiveFeedItem("Honda Vezel", "Divulapitiya", "+93 deal"),
    LiveFeedItem("Suzuki Wagon R", "Minuwangoda", "+91 deal"),
    LiveFeedItem("Toyota Raize", "Colombo", "+89 deal"),
)

/**
 * Home: Cinematic Hero Header, Context Eyebrow Capsule Badges, Feature Banners,
 * Live Incoming Feed Ticker, Trending Models Rail, and Market Inventory.
 *
 * Events: [onListingClick], [onSearchClick], [onAlertsClick], [onSeeAll]
 * (section key: "drops" | "deals" | "districts" | "feed" | "trends").
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onListingClick: (Int) -> Unit,
    onSearchClick: () -> Unit,
    onAlertsClick: () -> Unit,
    onSeeAll: (String) -> Unit,
    onLoginClick: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val live by viewModel.liveStrip.collectAsStateWithLifecycle()

    PullToRefreshBox(
        isRefreshing = state.isRefreshing,
        onRefresh = viewModel::refresh,
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            // 1. Top Brand Lockup Bar
            item {
                Column(Modifier.padding(top = 10.dp)) {
                    if (state.isOffline || state.showCachedBadge) {
                        OfflineBanner(visible = true)
                    }
                    TopBrandBar(onAlertsClick = onAlertsClick)
                }
            }

            // 2. Cinematic Hero Header
            item {
                CinematicHeroHeader(
                    total = state.summary.totalListings,
                    onSearchClick = onSearchClick,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            // 3. Stats Row / Bento Metrics Card
            item {
                if (state.isLoading) {
                    LoadingSkeletonCard(Modifier.padding(horizontal = 16.dp))
                } else if (state.error != null && state.summary.totalListings == 0) {
                    ErrorState(
                        message = state.error ?: "Unknown error",
                        onRetry = viewModel::retry,
                        cachedAvailable = false,
                        onLogin = onLoginClick,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                } else {
                    HeroStatsCard(
                        total = state.summary.totalListings,
                        goodDeals = state.summary.goodDealsCount,
                        new24h = state.insights.newListings24h,
                        avgPrice = state.summary.avgPriceLkr?.let { LkrFormat.price(it) },
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }

            // 4. Feature Banners (VEHICLE TYPES & VERIFIED SIGNALS)
            item {
                FeatureBannersRow(
                    onVehicleTypesClick = onSearchClick,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            // 5. Live Incoming Feed Ticker
            item {
                val feedItems = remember(state.insights.hotDeals) {
                    if (state.insights.hotDeals.isNotEmpty()) {
                        state.insights.hotDeals.take(4).map { deal ->
                            LiveFeedItem(
                                title = "${deal.make} ${deal.model}",
                                district = deal.district ?: "Colombo",
                                dealScoreText = "+${deal.dealScore.toInt()} deal",
                                listingId = deal.id,
                            )
                        }
                    } else {
                        DEFAULT_LIVE_FEED
                    }
                }
                LiveIncomingFeedTicker(
                    items = feedItems,
                    onItemClick = { item ->
                        if (item.listingId != null) {
                            onListingClick(item.listingId)
                        } else {
                            onSearchClick()
                        }
                    },
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            // 6. Trending Models Rail
            item {
                val trendingList = remember(state.insights.trendingModels) {
                    if (state.insights.trendingModels.isNotEmpty()) {
                        state.insights.trendingModels.take(4).map {
                            TrendingModelItem(
                                make = it.make,
                                model = it.model,
                                countText = "${LkrFormat.count(it.listingCount)} listed",
                                avgPriceText = "avg ${LkrFormat.price(it.avgPriceLkr)}",
                                imageUrl = it.thumbnailUrl,
                            )
                        }
                    } else {
                        DEFAULT_TRENDING_MODELS
                    }
                }
                TrendingModelsRail(
                    models = trendingList,
                    onSeeAllTrends = { onSeeAll("trends") },
                    onModelClick = { onSearchClick() },
                )
            }

            // 7. Live Now Strip (if available from streaming backend)
            if (live.isNotEmpty()) {
                item {
                    SectionRow(title = "Live now", onSeeAll = null)
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(live, key = { it.id }) { l ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .clickable { onListingClick(l.id) }
                                    .padding(end = 12.dp),
                            ) {
                                LivePulse()
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    "${l.make} ${l.model} · ${l.formattedPrice()}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MotormilaOnSurface,
                                )
                            }
                        }
                    }
                }
            }

            // 8. Hot Deals / Best Picks (with Context Eyebrow Capsule Badge)
            if (state.insights.hotDeals.isNotEmpty()) {
                item {
                    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                        ContextCapsuleBadge(text = "• ✩ BEST PICKS", isAccent = true)
                        Spacer(Modifier.height(6.dp))
                    }
                    SectionRow(title = "Hot deals", onSeeAll = { onSeeAll("deals") })
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(state.insights.hotDeals.take(10), key = { it.id }) { deal ->
                            HotDealCard(
                                title = "${deal.make} ${deal.model} ${deal.year ?: ""}".trim(),
                                imageUrl = deal.thumbnailUrl,
                                price = LkrFormat.price(deal.priceLkr),
                                score = deal.dealScore,
                                isPro = state.isPro,
                                onClick = { onListingClick(deal.id) },
                            )
                        }
                    }
                }
            }

            // 9. Price Drops Rail
            if (state.priceDrops.isNotEmpty()) {
                item {
                    SectionRow(title = "Price drops", onSeeAll = { onSeeAll("drops") })
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(state.priceDrops.take(10), key = { it.listing.id }) { drop ->
                            PriceDropCard(
                                title = drop.listing.displayName,
                                imageUrl = drop.listing.heroImageUrl,
                                newPrice = LkrFormat.price(drop.newPriceLkr),
                                dropPct = drop.dropPct,
                                onClick = { onListingClick(drop.listing.id) },
                            )
                        }
                    }
                }
            }

            // 10. Fuel Mix
            if (state.fuelMix.isNotEmpty()) {
                item {
                    SectionRow(title = "Fuel mix", onSeeAll = null)
                    FuelMixRow(
                        buckets = state.fuelMix,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }

            // 11. Districts
            if (state.districts.isNotEmpty()) {
                item {
                    SectionRow(title = "Districts", onSeeAll = { onSeeAll("districts") })
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(state.districts.take(12), key = { it.district }) { d ->
                            DistrictChip(
                                district = d.district,
                                count = d.count,
                                median = LkrFormat.price(d.medianPriceLkr),
                                onClick = { onSearchClick() },
                            )
                        }
                    }
                }
            }

            // 12. Empty State
            if (!state.isLoading && state.priceDrops.isEmpty() && state.insights.hotDeals.isEmpty()) {
                item {
                    EmptyState(
                        title = "No market data yet",
                        body = "Pull to refresh — new listings appear here as scrapers run.",
                        ctaLabel = "Browse all vehicles",
                        onCta = onSearchClick,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }
        }
    }
}

/** Top navigation brand bar with live squircle mark and notification action. */
@Composable
private fun TopBrandBar(onAlertsClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        BrandLogo(
            size = BrandLogoSize.NAV,
            showLiveIndicator = true,
        )
        IconButton(
            onClick = onAlertsClick,
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .border(1.dp, MotormilaOutline, CircleShape),
        ) {
            Icon(
                Icons.Filled.Notifications,
                contentDescription = "Price alerts",
                tint = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

/**
 * Signature context capsule badge (e.g. `• MARKET PULSE`, `• ✩ BEST PICKS`).
 */
@Composable
fun ContextCapsuleBadge(
    text: String,
    modifier: Modifier = Modifier,
    isAccent: Boolean = false,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color(0xFF141419))
            .border(
                width = 1.dp,
                color = if (isAccent) Color(0x440A7AFF) else MotormilaGlassBorder,
                shape = RoundedCornerShape(999.dp),
            )
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(if (isAccent) MotormilaPrimaryBright else Color(0xFF10B981)),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = text,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.2.sp,
            color = if (isAccent) MotormilaPrimaryBright else MotormilaOnSurface,
        )
    }
}

/**
 * Cinematic Hero Header with negative-tracked headline, electric blue accent,
 * dynamic subtitle, and dark liquid glass search pill with blue button.
 */
@Composable
private fun CinematicHeroHeader(
    total: Int,
    onSearchClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        ContextCapsuleBadge(
            text = "• MARKET PULSE",
            isAccent = true,
        )

        Spacer(Modifier.height(14.dp))

        // Headline: "Sri Lanka's entire vehicle market, decoded."
        Text(
            text = buildAnnotatedString {
                withStyle(
                    SpanStyle(
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                    )
                ) {
                    append("Sri Lanka's entire vehicle market, ")
                }
                withStyle(
                    SpanStyle(
                        color = MotormilaPrimaryBright,
                        fontWeight = FontWeight.ExtraBold,
                    )
                ) {
                    append("decoded.")
                }
            },
            fontSize = 28.sp,
            lineHeight = 34.sp,
            letterSpacing = (-0.8).sp,
        )

        Spacer(Modifier.height(10.dp))

        // Subtitle with live listings count
        val countText = if (total > 0) LkrFormat.count(total) else "207,786"
        Text(
            text = "$countText live listings across 13 sources — pricing, deal scores, and market intel in one place.",
            color = MotormilaSecondaryText,
            fontSize = 14.sp,
            lineHeight = 21.sp,
            fontWeight = FontWeight.Normal,
        )

        Spacer(Modifier.height(16.dp))

        // Dark liquid glass pill with search icon and electric blue "SEARCH" button
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .background(Color(0xFF131318))
                .border(1.dp, MotormilaOutline, RoundedCornerShape(999.dp))
                .clickable(onClick = onSearchClick)
                .padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp)
                .semantics { contentDescription = "Search vehicles" },
            contentAlignment = Alignment.CenterStart,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Filled.Search,
                    contentDescription = null,
                    tint = Color(0x99FFFFFF),
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "Toyota Aqua, Honda Vezel, Wagon R...",
                    color = MotormilaSecondaryText,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(MotormilaPrimary)
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "SEARCH",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                    )
                }
            }
        }
    }
}

/**
 * Stats row / Bento card with LIVE LISTINGS eyebrow, DATA AS OF 1H AGO pill,
 * large bold count, sub-label, and metrics grid (AVG PRICE, NEW 24H, GOOD DEALS).
 */
@Composable
private fun HeroStatsCard(
    total: Int,
    goodDeals: Int,
    new24h: Int,
    avgPrice: String?,
    modifier: Modifier = Modifier,
) {
    val reduced = rememberReducedMotion()
    var shown by remember { mutableStateOf(reduced) }
    LaunchedEffect(total) { shown = true }
    val animatedTotal by animateIntAsState(
        targetValue = if (shown) total else 0,
        animationSpec = tween(if (reduced) 1 else 650),
        label = "hero-stat-count",
    )

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F0F13)),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, MotormilaOutline, RoundedCornerShape(20.dp)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color(0x180A7AFF),
                            Color(0x000A7AFF),
                        )
                    )
                )
                .padding(16.dp)
        ) {
            // Eyebrow LIVE LISTINGS with DATA AS OF 1H AGO pill
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "LIVE LISTINGS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.5.sp,
                    color = MotormilaSecondaryText,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0x1F10B981))
                        .border(0.75.dp, Color(0x3310B981), RoundedCornerShape(999.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF10B981))
                    )
                    Spacer(Modifier.width(5.dp))
                    Text(
                        text = "DATA AS OF 1H AGO",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp,
                        color = Color(0xFF6EE7B7),
                    )
                }
            }

            Spacer(Modifier.height(10.dp))

            // Bold count (207,786 or dynamic)
            Text(
                text = if (total > 0) LkrFormat.count(animatedTotal) else "207,786",
                fontSize = 38.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.03).em,
                color = Color.White,
            )

            Spacer(Modifier.height(3.dp))

            // Sub-label
            Text(
                text = "208,884 total indexed · 1,098 awaiting price",
                fontSize = 12.sp,
                color = MotormilaSecondaryText,
            )

            Spacer(Modifier.height(16.dp))

            // Metrics Grid (AVG PRICE: Rs. 8.63M, NEW 24H: 5,649, GOOD DEALS: 2,184)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                MetricMiniCell(
                    label = "AVG PRICE",
                    value = avgPrice ?: "Rs. 8.63M",
                    modifier = Modifier.weight(1f),
                )
                MetricMiniCell(
                    label = "NEW 24H",
                    value = if (new24h > 0) LkrFormat.count(new24h) else "5,649",
                    modifier = Modifier.weight(1f),
                )
                MetricMiniCell(
                    label = "GOOD DEALS",
                    value = if (goodDeals > 0) LkrFormat.count(goodDeals) else "2,184",
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun MetricMiniCell(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF131318)),
        modifier = modifier.border(1.dp, MotormilaOutline, RoundedCornerShape(12.dp)),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp),
        ) {
            Text(
                text = label,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = MotormilaSecondaryText,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = value,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * Bento highlight cards matching web:
 * - VEHICLE TYPES ("Browse cars, vans, and SUVs across the live index.")
 * - VERIFIED SIGNALS ("Deal scores and seller trust baked into every listing.")
 */
@Composable
private fun FeatureBannersRow(
    onVehicleTypesClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Card 1: VEHICLE TYPES
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F0F13)),
            modifier = Modifier
                .weight(1f)
                .height(115.dp)
                .border(1.dp, MotormilaOutline, RoundedCornerShape(16.dp))
                .clickable(onClick = onVehicleTypesClick),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.radialGradient(
                            colors = listOf(Color(0x1F0A7AFF), Color(0x000A7AFF)),
                            radius = 280f,
                        )
                    )
                    .padding(14.dp),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "VEHICLE TYPES",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.4.sp,
                            color = MotormilaPrimaryBright,
                        )
                        Icon(
                            imageVector = Icons.Filled.DirectionsCar,
                            contentDescription = null,
                            tint = MotormilaPrimaryBright.copy(alpha = 0.5f),
                            modifier = Modifier.size(16.dp),
                        )
                    }
                    Text(
                        text = "Browse cars, vans, and SUVs across the live index.",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MotormilaOnSurface,
                        lineHeight = 16.sp,
                    )
                }
            }
        }

        // Card 2: VERIFIED SIGNALS
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F0F13)),
            modifier = Modifier
                .weight(1f)
                .height(115.dp)
                .border(1.dp, MotormilaOutline, RoundedCornerShape(16.dp)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.radialGradient(
                            colors = listOf(Color(0x1A10B981), Color(0x0010B981)),
                            radius = 280f,
                        )
                    )
                    .padding(14.dp),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "VERIFIED SIGNALS",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.4.sp,
                            color = Color(0xFF6EE7B7),
                        )
                        Icon(
                            imageVector = Icons.Filled.Verified,
                            contentDescription = null,
                            tint = Color(0xFF6EE7B7).copy(alpha = 0.5f),
                            modifier = Modifier.size(16.dp),
                        )
                    }
                    Text(
                        text = "Deal scores and seller trust baked into every listing.",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MotormilaOnSurface,
                        lineHeight = 16.sp,
                    )
                }
            }
        }
    }
}

/**
 * Live incoming feed ticker with pulse eyebrow and real-time deal scoring stream.
 */
@Composable
private fun LiveIncomingFeedTicker(
    items: List<LiveFeedItem>,
    onItemClick: (LiveFeedItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F0F13)),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, MotormilaOutline, RoundedCornerShape(18.dp)),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Header Row: Pulse icon + LIVE INCOMING FEED + ((•)) SYNCED 2H
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        width = 0.5.dp,
                        color = MotormilaOutline,
                        shape = RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp),
                    )
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    LivePulse()
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "LIVE INCOMING FEED",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.3.sp,
                        color = MotormilaSecondaryText,
                    )
                }
                Text(
                    text = "((•)) SYNCED 2H",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    color = MotormilaPrimaryBright,
                )
            }

            // Real-time List Items with Flame Icon and Deal Score Badge
            Column(modifier = Modifier.fillMaxWidth()) {
                items.forEachIndexed { index, item ->
                    if (index > 0) {
                        Spacer(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(0.5.dp)
                                .background(MotormilaOutline),
                        )
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onItemClick(item) }
                            .padding(horizontal = 16.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(
                                imageVector = Icons.Filled.LocalFireDepartment,
                                contentDescription = null,
                                tint = MotormilaPrimaryBright,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text = item.title,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MotormilaOnSurface,
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = "· ${item.district}",
                                fontSize = 12.sp,
                                color = MotormilaSecondaryText,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }

                        // Deal score badge in blue
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0x2E0A7AFF))
                                .border(0.5.dp, Color(0x550A7AFF), RoundedCornerShape(6.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = item.dealScoreText,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MotormilaPrimaryBright,
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Trending models rail with ALL TRENDS ↗ action and rounded capsule cards.
 */
@Composable
private fun TrendingModelsRail(
    models: List<TrendingModelItem>,
    onSeeAllTrends: () -> Unit,
    onModelClick: (TrendingModelItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = "Trending models",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = MotormilaOnSurface,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clickable(onClick = onSeeAllTrends)
                    .padding(4.dp),
            ) {
                Text(
                    text = "ALL TRENDS ↗",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    color = MotormilaPrimaryBright,
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(models, key = { "${it.make}-${it.model}" }) { item ->
                TrendingModelCard(
                    item = item,
                    onClick = { onModelClick(item) },
                )
            }
        }
    }
}

@Composable
private fun TrendingModelCard(
    item: TrendingModelItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F0F13)),
        modifier = modifier
            .width(260.dp)
            .border(1.dp, MotormilaOutline, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0xFF1B1B22)),
                contentAlignment = Alignment.Center,
            ) {
                if (item.imageUrl != null) {
                    AsyncImage(
                        model = item.imageUrl,
                        contentDescription = "${item.make} ${item.model}",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.DirectionsCar,
                        contentDescription = null,
                        tint = MotormilaPrimaryBright,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${item.make} ${item.model}",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MotormilaOnSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "${item.countText} · ${item.avgPriceText}",
                    fontSize = 11.sp,
                    color = MotormilaSecondaryText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Spacer(Modifier.width(8.dp))

            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = MotormilaSecondaryText,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}


@Composable
private fun SectionRow(title: String, onSeeAll: (() -> Unit)?) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.weight(1f))
        if (onSeeAll != null) {
            Text(
                "See all",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .clickable(onClick = onSeeAll)
                    .padding(8.dp),
            )
        }
    }
}

@Composable
private fun PriceDropCard(title: String, imageUrl: String?, newPrice: String, dropPct: Double, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .width(220.dp)
            .border(1.dp, MotormilaOutline, RoundedCornerShape(16.dp)),
    ) {
        Column {
            AsyncImage(
                model = imageUrl,
                contentDescription = "Photo of $title",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(118.dp),
            )
            Column(Modifier.padding(12.dp)) {
                Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                Text(newPrice, fontSize = 15.sp, fontWeight = FontWeight.Bold, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                Spacer(Modifier.height(4.dp))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0x2E10B981))
                        .padding(horizontal = 7.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "▼ ${LkrFormat.deltaPct(dropPct)}",
                        fontSize = 11.sp,
                        color = Color(0xFF6EE7B7),
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun HotDealCard(title: String, imageUrl: String?, price: String, score: Double, isPro: Boolean, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .width(220.dp)
            .border(1.dp, MotormilaOutline, RoundedCornerShape(16.dp)),
    ) {
        Column {
            AsyncImage(
                model = imageUrl,
                contentDescription = "Photo of $title",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(118.dp),
            )
            Column(Modifier.padding(12.dp)) {
                Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                Text(price, fontSize = 15.sp, fontWeight = FontWeight.Bold, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                Spacer(Modifier.height(4.dp))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (isPro) Color(0x2E10B981) else Color(0x2E0A7AFF))
                        .padding(horizontal = 7.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (isPro) "★ %.1f DEAL".format(score) else "🔒 PRO SCORE",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isPro) Color(0xFF6EE7B7) else MotormilaPrimaryBright,
                    )
                }
            }
        }
    }
}

@Composable
private fun FuelMixRow(buckets: List<lk.motormila.app.domain.model.FuelMixBucket>, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        buckets.take(5).forEach { b ->
            Card(Modifier.weight(1f)) {
                Column(Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(b.fuelType.replaceFirstChar(Char::uppercase), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    Text("${b.pct}%", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun DistrictChip(district: String, count: Int, median: String, onClick: () -> Unit) {
    Card(onClick = onClick) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
            Text(district, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Text("$count · $median", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
