package lk.motormila.app.ui.watchlist

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAlert
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.format.formatLkrDelta
import lk.motormila.app.core.format.formatPct
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.core.ui.EmptyState
import lk.motormila.app.core.ui.ErrorRetry
import lk.motormila.app.core.ui.HealthRing
import lk.motormila.app.core.ui.SkeletonList
import lk.motormila.app.core.ui.SteeringWheelGraphic
import lk.motormila.app.domain.model.WatchItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WatchlistScreen(
    onOpenDetail: (id: Int) -> Unit,
    onCreateAlert: (id: Int) -> Unit,
    onBrowse: () -> Unit,
    viewModel: WatchlistViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(WatchlistUiEvent.DismissError)
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Watchlist") }) },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = { viewModel.onEvent(WatchlistUiEvent.Refresh) },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                state.isLoading -> SkeletonList()
                state.error != null && state.items.isEmpty() ->
                    ErrorRetry(state.error ?: "Error", onRetry = { viewModel.onEvent(WatchlistUiEvent.Refresh) })

                state.items.isEmpty() -> EmptyState(
                    title = "Nothing watched yet",
                    body = "Tap the steering wheel — save a listing and we'll flag every price drop against fair value.",
                    actionLabel = "Browse listings",
                    onAction = onBrowse,
                    graphic = { SteeringWheelGraphic() },
                )

                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(state.items, key = { it.id }) { item ->
                        WatchRow(
                            item = item,
                            flash = item.id in state.droppedIds,
                            onOpen = { onOpenDetail(item.id) },
                            onAlert = { onCreateAlert(item.id) },
                            onRemove = { viewModel.onEvent(WatchlistUiEvent.Remove(item.id)) },
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WatchRow(
    item: WatchItem,
    flash: Boolean,
    onOpen: () -> Unit,
    onAlert: () -> Unit,
    onRemove: () -> Unit,
) {
    val reducedMotion = rememberReducedMotion()
    // Price-drop flash: warm tint that settles; static tint under reduced motion.
    val flashTarget = if (flash) Color(0xFFFFF3C4) else MaterialTheme.colorScheme.surfaceContainerLow
    val bg by animateColorAsState(
        targetValue = flashTarget,
        animationSpec = tween(if (reducedMotion) 0 else 900),
        label = "priceDropFlash",
    )
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onAlert()
            }
            false // snap back; swipe creates an alert, it never deletes
        },
    )

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            // 72dp swipe-to-alert rail
            Box(
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.primaryContainer)
                    .padding(end = 16.dp)
                    .semantics { contentDescription = "Swipe to create price alert" },
                contentAlignment = Alignment.CenterEnd,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.width(72.dp),
                ) {
                    Icon(
                        Icons.Filled.AddAlert,
                        contentDescription = "Create alert",
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
        },
        content = {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .semantics { contentDescription = "Watched ${item.title} at ${formatLkr(item.priceLkr)}" },
                colors = CardDefaults.cardColors(containerColor = bg),
                onClick = onOpen,
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(12.dp)
                        .heightIn(min = 48.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HealthRing(
                        fractionUnderFmv = (item.underFmvFraction?.toFloat() ?: 0f).coerceIn(0f, 1f),
                        modifier = Modifier.size(44.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(item.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(
                            "${formatLkr(item.priceLkr)} · ${item.district}",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        val drop = (item.previousPriceLkr ?: item.priceLkr ?: 0.0) - (item.priceLkr ?: 0.0)
                        if (drop > 0) {
                            Text(
                                "▼ ${formatLkrDelta(-drop)} · ${formatPct((item.underFmvFraction ?: 0.0) * 100)} under FMV",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.tertiary,
                            )
                        } else if (item.fmvLkr != null) {
                            Text(
                                "FMV ${formatLkr(item.fmvLkr)}",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    IconButton(
                        onClick = onAlert,
                        modifier = Modifier
                            .size(48.dp)
                            .semantics { contentDescription = "Create price alert for ${item.title}" },
                    ) {
                        Icon(Icons.Filled.AddAlert, contentDescription = null)
                    }
                    IconButton(
                        onClick = onRemove,
                        modifier = Modifier
                            .size(48.dp)
                            .semantics { contentDescription = "Remove ${item.title} from watchlist" },
                    ) {
                        Icon(Icons.Filled.Delete, contentDescription = null)
                    }
                }
            }
        },
    )
}
