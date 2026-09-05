package lk.motormila.app.ui.search

import androidx.compose.animation.core.tween
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAlert
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CompareArrows
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import lk.motormila.app.domain.repository.ListingSorts
import lk.motormila.app.ui.components.EmptyState
import lk.motormila.app.ui.components.ErrorState
import lk.motormila.app.ui.components.FilterSheet
import lk.motormila.app.ui.components.ListingCard
import lk.motormila.app.ui.components.LoadingSkeletonCard
import lk.motormila.app.ui.components.OfflineBanner
import lk.motormila.app.ui.components.SearchBar
import lk.motormila.app.ui.components.rememberReducedMotion

/**
 * Search: query + suggestions + filters + sort + Paging3 LazyColumn
 * (stagger first-8 35ms) + compare-select tray (max 3) + save-watchlist +
 * create-alert-from-filters.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    onListingClick: (Int) -> Unit,
    onCompare: (List<Int>) -> Unit,
    viewModel: SearchViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val items = viewModel.paging.collectAsLazyPagingItems()
    val reducedMotion = rememberReducedMotion()
    val snackbar = remember { SnackbarHostState() }
    val isRefreshing = items.loadState.refresh is LoadState.Loading

    LaunchedEffect(state.alertSaved) {
        if (state.alertSaved) {
            snackbar.showSnackbar("Alert saved — we'll notify you of matches")
            viewModel.consumeAlertSaved()
        }
    }
    LaunchedEffect(state.error) {
        if (state.error != null) {
            snackbar.showSnackbar(state.error ?: "Error")
            viewModel.clearError()
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            if (items.loadState.refresh is LoadState.Error) {
                OfflineBanner(visible = true)
            }
            SearchBar(
                query = state.query,
                onQueryChange = viewModel::onQueryChange,
                onSearch = viewModel::onSearch,
                suggestions = state.suggestions,
                recentSearches = state.recentSearches,
                onSuggestionClick = { onListingClick(it.id) },
                onRecentClick = { viewModel.onSearch(it) },
                onVoiceClick = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )
            SortFilterRow(
                sort = state.filters.sort,
                onSort = viewModel::onSortChange,
                onFilters = viewModel::openFilters,
                onCreateAlert = viewModel::createAlertFromFilters,
            )
            PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = { items.refresh() },
                modifier = Modifier.weight(1f),
            ) {
                when {
                    isRefreshing -> {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(5) { LoadingSkeletonCard() }
                        }
                    }
                    items.loadState.refresh is LoadState.Error -> {
                        val err = items.loadState.refresh as LoadState.Error
                        ErrorState(
                            message = err.error.message ?: "Couldn't load results",
                            onRetry = { items.retry() },
                            cachedAvailable = items.itemCount > 0,
                            onShowCached = { items.retry() },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                    items.itemCount == 0 -> {
                        EmptyState(
                            title = "No vehicles found",
                            body = "Try widening the budget or clearing a filter.",
                            ctaLabel = "Reset filters",
                            onCta = viewModel::resetFilters,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                    else -> {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier
                                .fillMaxSize()
                                .semantics { contentDescription = "Search results" },
                        ) {
                            items(
                                count = items.itemCount,
                                key = { i -> items[i]?.id ?: -i },
                            ) { i ->
                                val listing = items[i]
                                if (listing != null) {
                                    StaggeredItem(index = i, reducedMotion = reducedMotion) {
                                        ListingCard(
                                            listing = listing,
                                            isWatched = false,
                                            onClick = { onListingClick(listing.id) },
                                            onWatchToggle = { viewModel.toggleWatch(listing) },
                                        )
                                    }
                                    CompareToggleRow(
                                        selected = state.compareIds.contains(listing.id),
                                        enabled = state.compareIds.contains(listing.id) ||
                                            state.compareIds.size < 4,
                                        onToggle = { viewModel.toggleCompare(listing.id) },
                                    )
                                }
                            }
                            if (items.loadState.append is LoadState.Loading) {
                                item { LoadingSkeletonCard() }
                            }
                            if (items.loadState.append is LoadState.Error) {
                                item {
                                    ErrorState(
                                        message = "Couldn't load more",
                                        onRetry = { items.retry() },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Compare tray (max 3).
        if (state.compareIds.isNotEmpty()) {
            CompareTray(
                count = state.compareIds.size,
                onCompare = { onCompare(state.compareIds) },
                onClear = viewModel::clearCompare,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
        SnackbarHost(snackbar, modifier = Modifier.align(Alignment.BottomCenter))

        if (state.showFilterSheet) {
            FilterSheet(
                current = state.filters,
                makes = state.makes,
                districts = state.districts,
                resultCount = items.itemCount.takeIf { it > 0 },
                onApply = viewModel::applyFilters,
                onReset = viewModel::resetFilters,
                onDismiss = viewModel::closeFilters,
            )
        }
    }
}

@Composable
private fun SortFilterRow(
    sort: String,
    onSort: (String) -> Unit,
    onFilters: () -> Unit,
    onCreateAlert: () -> Unit,
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        item {
            IconButton(onClick = onFilters, modifier = Modifier.size(48.dp)) {
                Icon(Icons.Filled.FilterList, contentDescription = "Open filters")
            }
        }
        items(ListingSorts.ALL) { s ->
            FilterChip(
                selected = sort == s,
                onClick = { onSort(s) },
                colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                    selectedContainerColor = lk.motormila.app.ui.theme.MotormilaPrimary,
                    selectedLabelColor = androidx.compose.ui.graphics.Color.White,
                    containerColor = MaterialTheme.colorScheme.surface,
                    labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                ),
                border = androidx.compose.material3.FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = sort == s,
                    borderColor = lk.motormila.app.ui.theme.MotormilaOutline,
                    selectedBorderColor = lk.motormila.app.ui.theme.MotormilaPrimaryBright,
                ),
                label = {
                    Text(
                        when (s) {
                            ListingSorts.NEWEST -> "Newest"
                            ListingSorts.DEAL_SCORE -> "Best deal"
                            ListingSorts.PRICE_ASC -> "Price ↑"
                            ListingSorts.PRICE_DESC -> "Price ↓"
                            ListingSorts.MILEAGE_ASC -> "Low km"
                            else -> s
                        },
                        fontWeight = if (sort == s) FontWeight.Bold else FontWeight.Medium,
                    )
                },
            )
        }
        item {
            IconButton(onClick = onCreateAlert, modifier = Modifier.size(48.dp)) {
                Icon(Icons.Filled.AddAlert, contentDescription = "Create alert from these filters")
            }
        }
    }
}

/**
 * First-8 stagger: 35ms per index fade+rise in graphicsLayer (no layout
 * pass). Skipped entirely when reduced motion is on or index >= 8.
 */
@Composable
private fun StaggeredItem(index: Int, reducedMotion: Boolean, content: @Composable () -> Unit) {
    if (reducedMotion || index >= 8) {
        content()
        return
    }
    val shown = remember { androidx.compose.runtime.mutableStateOf(false) }
    LaunchedEffect(index) {
        kotlinx.coroutines.delay(index * 35L)
        shown.value = true
    }
    val alpha by androidx.compose.animation.core.animateFloatAsState(
        targetValue = if (shown.value) 1f else 0f,
        animationSpec = tween(220),
        label = "stagger-alpha",
    )
    Box(
        Modifier.graphicsLayer {
            this.alpha = alpha
            translationY = (1f - alpha) * 24f
        },
    ) { content() }
}

@Composable
private fun CompareToggleRow(selected: Boolean, enabled: Boolean, onToggle: () -> Unit) {    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FilterChip(
            selected = selected,
            enabled = enabled,
            onClick = onToggle,
            label = { Text(if (selected) "Added to compare" else "Compare") },
            leadingIcon = {
                Icon(
                    if (selected) Icons.Filled.Check else Icons.Filled.CompareArrows,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                )
            },
        )
    }
}

@Composable
private fun CompareTray(count: Int, onCompare: () -> Unit, onClear: () -> Unit, modifier: Modifier = Modifier) {
    androidx.compose.material3.Surface(
        tonalElevation = 6.dp,
        shadowElevation = 8.dp,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        modifier = modifier.padding(16.dp),
    ) {
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("$count/4 selected", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f))
            Text(
                "Clear",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .clickable(onClick = onClear)
                    .padding(8.dp),
            )
            Spacer(Modifier.width(8.dp))
            Button(onClick = onCompare, enabled = count >= 2) { Text("Compare") }
        }
    }
}
