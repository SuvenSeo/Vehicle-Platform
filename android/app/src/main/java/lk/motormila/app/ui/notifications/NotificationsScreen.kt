package lk.motormila.app.ui.notifications

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.core.ui.EmptyState
import lk.motormila.app.core.ui.ErrorRetry
import lk.motormila.app.core.ui.SkeletonList
import lk.motormila.app.domain.model.AppNotification
import lk.motormila.app.ui.components.OfflineBanner
import lk.motormila.app.ui.theme.rememberHaptics

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    onOpenNotification: (id: String) -> Unit,
    viewModel: NotificationsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    val reducedMotion = rememberReducedMotion()
    val haptics = rememberHaptics()

    LaunchedEffect(state.error) {
        state.error?.let {
            if (!reducedMotion) haptics.reject()
            snacks.showSnackbar(it)
            viewModel.onEvent(NotificationsUiEvent.DismissError)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Inbox")
                        if (state.unreadCount > 0) {
                            Badge(
                                modifier = Modifier.padding(start = 8.dp)
                                    .semantics { contentDescription = "${state.unreadCount} unread" },
                            ) { Text(state.unreadCount.toString()) }
                        }
                    }
                },
                actions = {
                    TextButton(
                        onClick = { viewModel.onEvent(NotificationsUiEvent.MarkAllRead) },
                        enabled = state.unreadCount > 0,
                        modifier = Modifier.heightIn(min = 48.dp),
                    ) { Text("Mark all read") }
                },
            )
        },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = { viewModel.onEvent(NotificationsUiEvent.Refresh) },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when {
                state.isLoading -> SkeletonList()
                state.error != null && state.items.isEmpty() ->
                    ErrorRetry(state.error ?: "Error", onRetry = { viewModel.onEvent(NotificationsUiEvent.Refresh) })

                state.items.isEmpty() -> EmptyState(
                    title = "All caught up",
                    body = "Price drops, alert matches and market pulses will land here.",
                )

                else -> LazyColumn(
                    Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item { OfflineBanner(visible = state.offline) }
                    items(state.items, key = { it.id }) { n ->
                        NotificationRow(
                            n = n,
                            onOpen = {
                                if (!reducedMotion) haptics.tick()
                                viewModel.onEvent(NotificationsUiEvent.MarkRead(n.id.toString()))
                                onOpenNotification(n.id.toString())
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(n: AppNotification, onOpen: () -> Unit) {
    // kind is mapper-derived (DATA_CONTRACT §1): "listing" iff the backend
    // link contained /listings/{id}, else "alert". Listing rows deep-link to
    // detail via the graph's Int parsing; alert rows open the inbox only.
    val kindLabel = if (n.kind == "listing") "Listing" else "Alert"
    Card(
        onClick = onOpen,
        modifier = Modifier.fillMaxWidth()
            .semantics { contentDescription = "${if (n.isRead) "Read" else "Unread"}: ${n.title}" },
        colors = CardDefaults.cardColors(
            containerColor = if (n.isRead) MaterialTheme.colorScheme.surface
            else MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f),
        ),
    ) {
        Column(Modifier.padding(16.dp).heightIn(min = 48.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    n.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (n.isRead) FontWeight.Normal else FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Badge(
                    modifier = Modifier.padding(start = 8.dp)
                        .semantics { contentDescription = "$kindLabel notification" },
                ) { Text(kindLabel) }
            }
            Text(n.body, style = MaterialTheme.typography.bodySmall)
            Text(
                n.createdAt,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
