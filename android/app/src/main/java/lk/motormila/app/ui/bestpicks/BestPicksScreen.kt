package lk.motormila.app.ui.bestpicks

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import kotlinx.coroutines.launch
import lk.motormila.app.R
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.core.format.formatPct
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.model.PriceDrop
import lk.motormila.app.ui.components.BrandLogo
import lk.motormila.app.ui.components.BrandLogoSize
import lk.motormila.app.ui.components.EmptyState
import lk.motormila.app.ui.components.ErrorState
import lk.motormila.app.ui.components.ListingCard
import lk.motormila.app.ui.components.LoadingSkeletonCard
import lk.motormila.app.ui.components.OfflineBanner
import lk.motormila.app.ui.theme.MotormilaBg
import lk.motormila.app.ui.theme.MotormilaGood
import lk.motormila.app.ui.theme.MotormilaOnPrimary
import lk.motormila.app.ui.theme.MotormilaOnSurface
import lk.motormila.app.ui.theme.MotormilaOutline
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaSecondaryText
import lk.motormila.app.ui.theme.MotormilaSurface
import lk.motormila.app.ui.theme.MotormilaSurfaceHigh
import lk.motormila.app.ui.theme.rememberHaptics

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BestPicksScreen(
    onBack: () -> Unit,
    onListingClick: (Int) -> Unit,
    onSeeAllSearch: () -> Unit,
    viewModel: BestPicksViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pagingItems = viewModel.paging.collectAsLazyPagingItems()
    val snacks = remember { SnackbarHostState() }
    val reducedMotion = rememberReducedMotion()
    val haptics = rememberHaptics()
    val scope = rememberCoroutineScope()
    val backCd = stringResource(R.string.hub_back)
    val refreshCd = stringResource(R.string.hub_picks_cd_refresh)
    val lockedSort = stringResource(R.string.hub_picks_sort_locked)

    val pagingRefresh = pagingItems.loadState.refresh
    val pagingError = (pagingRefresh as? LoadState.Error)?.error?.message
    val pagingLoading = state.unlocked && pagingRefresh is LoadState.Loading && pagingItems.itemCount == 0
    val showInitialLoading = state.isLoading || pagingLoading
    val hasPicks = if (state.unlocked) pagingItems.itemCount > 0 else state.freePicks.isNotEmpty()
    val hasAny = hasPicks || state.priceDrops.isNotEmpty()
    val fatalError = state.error.takeIf { !hasAny && !showInitialLoading }
        ?: pagingError.takeIf { state.unlocked && pagingItems.itemCount == 0 && pagingRefresh is LoadState.Error }

    LaunchedEffect(state.error) {
        val message = state.error
        if (message != null && hasAny) {
            snacks.showSnackbar(message)
            viewModel.onEvent(BestPicksUiEvent.DismissError)
        }
    }

    Scaffold(
        containerColor = MotormilaBg,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BrandLogo(
                            size = BrandLogoSize.COMPACT,
                            showWordmark = false,
                            showTagline = false,
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.hub_picks_title), fontWeight = FontWeight.Bold)
                    }
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            if (!reducedMotion) haptics.tick()
                            onBack()
                        },
                        modifier = Modifier.size(48.dp).semantics { contentDescription = backCd },
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = backCd)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MotormilaBg,
                    titleContentColor = MotormilaOnSurface,
                    navigationIconContentColor = MotormilaOnSurface,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = {
                viewModel.onEvent(BestPicksUiEvent.Refresh)
                pagingItems.refresh()
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .semantics { contentDescription = refreshCd },
        ) {
            when {
                showInitialLoading -> PicksSkeleton()
                fatalError != null ->
                    ErrorState(
                        message = fatalError,
                        onRetry = {
                            viewModel.onEvent(BestPicksUiEvent.Refresh)
                            pagingItems.retry()
                        },
                        modifier = Modifier.fillMaxSize(),
                    )
                else -> LazyColumn(
                    Modifier.fillMaxSize().padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item { OfflineBanner(visible = state.offline) }
                    item { PicksHero(unlocked = state.unlocked) }
                    item {
                        SortRow(
                            unlocked = state.unlocked,
                            sort = state.sort,
                            onSort = { next ->
                                if (!reducedMotion) haptics.tick()
                                if (next == BestPicksSort.DEAL_SCORE && !state.unlocked) {
                                    scope.launch { snacks.showSnackbar(lockedSort) }
                                } else {
                                    viewModel.onEvent(BestPicksUiEvent.SortChanged(next))
                                }
                            },
                        )
                    }
                    item {
                        CutsSection(
                            drops = state.priceDrops,
                            onListingClick = onListingClick,
                            onHaptic = { if (!reducedMotion) haptics.tick() },
                        )
                    }
                    item {
                        Text(
                            text = if (state.unlocked) {
                                stringResource(R.string.hub_picks_ranked)
                            } else {
                                stringResource(R.string.hub_picks_free_teasers)
                            },
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = MotormilaPrimary,
                            ),
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                        )
                    }
                    if (!hasPicks) {
                        item {
                            EmptyState(
                                title = stringResource(R.string.hub_picks_empty_title),
                                body = stringResource(R.string.hub_picks_empty_body),
                                ctaLabel = stringResource(R.string.hub_picks_see_all),
                                onCta = onSeeAllSearch,
                                icon = Icons.Filled.Star,
                            )
                        }
                    } else if (state.unlocked) {
                        items(
                            count = pagingItems.itemCount,
                            key = { index -> pagingItems[index]?.id ?: -index },
                        ) { index ->
                            val listing = pagingItems[index]
                            if (listing != null) {
                                PickCard(
                                    listing = listing,
                                    watched = state.watchedIds.contains(listing.id),
                                    onClick = {
                                        if (!reducedMotion) haptics.tick()
                                        onListingClick(listing.id)
                                    },
                                    onWatch = {
                                        viewModel.onEvent(BestPicksUiEvent.ToggleWatch(listing))
                                    },
                                )
                            }
                        }
                        if (pagingItems.loadState.append is LoadState.Loading) {
                            item { LoadingSkeletonCard() }
                        }
                    } else {
                        items(state.freePicks, key = { it.id }) { listing ->
                            PickCard(
                                listing = listing,
                                watched = state.watchedIds.contains(listing.id),
                                onClick = {
                                    if (!reducedMotion) haptics.tick()
                                    onListingClick(listing.id)
                                },
                                onWatch = {
                                    viewModel.onEvent(BestPicksUiEvent.ToggleWatch(listing))
                                },
                            )
                        }
                        item { PicksUpgradeStrip() }
                    }
                    item {
                        val seeAll = stringResource(R.string.hub_picks_see_all)
                        Button(
                            onClick = {
                                if (!reducedMotion) haptics.tick()
                                onSeeAllSearch()
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MotormilaPrimary,
                                contentColor = MotormilaOnPrimary,
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .semantics { contentDescription = seeAll },
                        ) {
                            Text(seeAll, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
    }
}

@Composable
private fun PicksSkeleton() {
    val loadingCd = stringResource(R.string.hub_loading)
    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp)
            .semantics { contentDescription = loadingCd },
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        repeat(4) { LoadingSkeletonCard() }
    }
}

@Composable
private fun PicksHero(unlocked: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
        Surface(
            shape = RoundedCornerShape(50),
            color = MotormilaSurfaceHigh,
            border = BorderStroke(1.dp, MotormilaOutline),
        ) {
            Text(
                text = "• ${stringResource(R.string.hub_picks_eyebrow).uppercase()}",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = MotormilaPrimaryBright,
                ),
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
        Text(
            text = stringResource(R.string.hub_picks_headline),
            style = MaterialTheme.typography.headlineLarge.copy(
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp,
                color = MotormilaOnSurface,
            ),
        )
        Text(
            text = if (unlocked) {
                stringResource(R.string.hub_picks_description_pro)
            } else {
                stringResource(R.string.hub_picks_description_free)
            },
            style = MaterialTheme.typography.bodyMedium.copy(
                color = MotormilaSecondaryText,
                lineHeight = 20.sp,
            ),
        )
        Text(
            text = stringResource(R.string.hub_picks_min_score),
            style = MaterialTheme.typography.labelSmall.copy(color = MotormilaPrimaryBright),
        )
    }
}

@Composable
private fun SortRow(
    unlocked: Boolean,
    sort: BestPicksSort,
    onSort: (BestPicksSort) -> Unit,
) {
    val aria = stringResource(R.string.hub_picks_sort_aria)
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.semantics { contentDescription = aria },
    ) {
        SortChip(
            label = stringResource(R.string.hub_picks_sort_deal),
            selected = sort == BestPicksSort.DEAL_SCORE,
            locked = !unlocked,
            onClick = { onSort(BestPicksSort.DEAL_SCORE) },
        )
        SortChip(
            label = stringResource(R.string.hub_picks_sort_recency),
            selected = sort == BestPicksSort.RECENCY,
            locked = false,
            onClick = { onSort(BestPicksSort.RECENCY) },
        )
    }
}

@Composable
private fun SortChip(
    label: String,
    selected: Boolean,
    locked: Boolean,
    onClick: () -> Unit,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        leadingIcon = if (locked) {
            {
                Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
            }
        } else {
            null
        },
        modifier = Modifier.heightIn(min = 48.dp),
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
            selectedLabelColor = MotormilaPrimaryBright,
        ),
        border = FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = selected,
            borderColor = MotormilaOutline,
            selectedBorderColor = MotormilaPrimary,
        ),
    )
}

@Composable
private fun CutsSection(
    drops: List<PriceDrop>,
    onListingClick: (Int) -> Unit,
    onHaptic: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
        border = BorderStroke(1.dp, MotormilaOutline),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.TrendingDown, contentDescription = null, tint = MotormilaGood)
                Column {
                    Text(
                        stringResource(R.string.hub_picks_cuts_title),
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    )
                    Text(
                        stringResource(R.string.hub_picks_cuts_subtitle),
                        style = MaterialTheme.typography.labelSmall,
                        color = MotormilaSecondaryText,
                    )
                }
            }
            if (drops.isEmpty()) {
                Text(
                    stringResource(R.string.hub_picks_cuts_empty),
                    style = MaterialTheme.typography.bodySmall,
                    color = MotormilaSecondaryText,
                )
            } else {
                drops.forEach { drop ->
                    CutRow(drop = drop, onClick = {
                        onHaptic()
                        onListingClick(drop.listing.id)
                    })
                }
            }
        }
    }
}

@Composable
private fun CutRow(drop: PriceDrop, onClick: () -> Unit) {
    val pct = formatPct(drop.dropPct, 0).trimStart('+')
    val cd = stringResource(R.string.hub_picks_cd_drop, drop.listing.displayName, pct)
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MotormilaSurface,
        border = BorderStroke(1.dp, MotormilaOutline),
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = cd },
    ) {
        Column(Modifier.padding(12.dp).heightIn(min = 48.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    drop.listing.displayName,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    stringResource(R.string.hub_picks_cuts_drop, pct),
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = MotormilaGood,
                        fontFamily = FontFamily.Monospace,
                    ),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    LkrFormat.price(drop.previousPriceLkr),
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = MotormilaSecondaryText,
                        textDecoration = TextDecoration.LineThrough,
                        fontFamily = FontFamily.Monospace,
                    ),
                )
                Text(
                    LkrFormat.price(drop.newPriceLkr),
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    ),
                )
            }
        }
    }
}

@Composable
private fun PickCard(
    listing: Listing,
    watched: Boolean,
    onClick: () -> Unit,
    onWatch: () -> Unit,
) {
    ListingCard(
        listing = listing,
        isWatched = watched,
        onClick = onClick,
        onWatchToggle = onWatch,
    )
}

@Composable
private fun PicksUpgradeStrip() {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MotormilaPrimary.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MotormilaPrimary.copy(alpha = 0.35f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stringResource(R.string.hub_picks_upgrade_title),
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = MotormilaPrimaryBright),
            )
            Text(
                stringResource(R.string.hub_picks_upgrade_body),
                style = MaterialTheme.typography.bodySmall,
                color = MotormilaSecondaryText,
            )
        }
    }
}

