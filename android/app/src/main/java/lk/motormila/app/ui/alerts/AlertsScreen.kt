package lk.motormila.app.ui.alerts

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Badge
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.format.formatPct
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.core.ui.EmptyState
import lk.motormila.app.core.ui.ErrorRetry
import lk.motormila.app.core.ui.PrimaryAction
import lk.motormila.app.core.ui.SectionTitle
import lk.motormila.app.core.ui.SkeletonList
import lk.motormila.app.domain.model.Alert
import lk.motormila.app.domain.model.AlertMatch
import lk.motormila.app.ui.components.OfflineBanner
import lk.motormila.app.ui.theme.rememberHaptics

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AlertsScreen(
    onOpenDetail: (id: Int) -> Unit,
    onUpgrade: () -> Unit,
    viewModel: AlertsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    val reducedMotion = rememberReducedMotion()
    val haptics = rememberHaptics()

    LaunchedEffect(state.error) {
        state.error?.let {
            if (!reducedMotion) haptics.reject()
            snacks.showSnackbar(it)
            viewModel.onEvent(AlertsUiEvent.DismissError)
        }
    }
    LaunchedEffect(state.justCreatedId) {
        if (state.justCreatedId != null) {
            if (!reducedMotion) haptics.confirm()
            kotlinx.coroutines.delay(1600)
            viewModel.onEvent(AlertsUiEvent.ConsumeCreated)
        }
    }
    // Consume the confetti burst after it plays.

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Price alerts")
                        if (state.unreadCount > 0) {
                            Badge(
                                modifier = Modifier.padding(start = 8.dp)
                                    .semantics { contentDescription = "${state.unreadCount} unread notifications" },
                            ) { Text(state.unreadCount.toString()) }
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = { viewModel.onEvent(AlertsUiEvent.Refresh) },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when {
                state.isLoading -> SkeletonList()
                state.error != null && state.alerts.isEmpty() ->
                    ErrorRetry(state.error ?: "Error", onRetry = { viewModel.onEvent(AlertsUiEvent.Refresh) })

                else -> LazyColumn(
                    Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item { OfflineBanner(visible = state.offline) }
                    item { CreateForm(state, viewModel, onUpgrade) }
                    if (state.justCreatedId != null) {
                        item { ConfettiLite(modifier = Modifier.fillMaxWidth().height(64.dp)) }
                    }
                    item {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            SectionTitle("Active (${state.alerts.size})")
                            if (state.matchesLoading) {
                                Text(
                                    "Matching…",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            } else if (state.alerts.isNotEmpty()) {
                                TextButton(
                                    onClick = { viewModel.onEvent(AlertsUiEvent.RefreshMatches) },
                                    modifier = Modifier.heightIn(min = 48.dp),
                                ) { Text("Refresh matches") }
                            }
                        }
                    }
                    if (state.alerts.isEmpty()) {
                        item {
                            EmptyState(
                                title = "No alerts yet",
                                body = "Create one above — we'll ping you the moment a match lands under your max price.",
                            )
                        }
                    } else {
                        items(state.alerts, key = { it.id }) { alert ->
                            AlertRow(
                                alert = alert,
                                active = alert.active,
                                toggling = alert.id in state.togglingIds,
                                matches = state.matches.filter { m -> m.alertId == alert.id },
                                onOpenDetail = { if (!reducedMotion) haptics.tick(); onOpenDetail(it) },
                                onToggle = { viewModel.onEvent(AlertsUiEvent.ToggleActive(alert.id, it)) },
                                onEdit = { viewModel.onEvent(AlertsUiEvent.Prefill(alert.id)) },
                                onDelete = { viewModel.onEvent(AlertsUiEvent.Delete(alert.id)) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CreateForm(state: AlertsUiState, viewModel: AlertsViewModel, onUpgrade: () -> Unit) {
    val f = state.form
    val editing = state.editingId != null
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            SectionTitle(if (editing) "Edit alert" else "New alert")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = f.make, onValueChange = { viewModel.onEvent(AlertsUiEvent.FormChanged(f.copy(make = it))) },
                    label = { Text("Make") }, singleLine = true,
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                )
                OutlinedTextField(
                    value = f.model, onValueChange = { viewModel.onEvent(AlertsUiEvent.FormChanged(f.copy(model = it))) },
                    label = { Text("Model (optional)") }, singleLine = true,
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = f.district, onValueChange = { viewModel.onEvent(AlertsUiEvent.FormChanged(f.copy(district = it))) },
                    label = { Text("District") }, singleLine = true,
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                )
                OutlinedTextField(
                    value = f.maxPrice, onValueChange = { viewModel.onEvent(AlertsUiEvent.FormChanged(f.copy(maxPrice = it))) },
                    label = { Text("Max (e.g. 8m)") }, singleLine = true,
                    supportingText = { Text("Triggers at or under this price") },
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                )
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = f.push,
                    onClick = { viewModel.onEvent(AlertsUiEvent.FormChanged(f.copy(push = !f.push))) },
                    label = { Text("Push") }, modifier = Modifier.heightIn(min = 48.dp),
                )
                FilterChip(
                    selected = f.email,
                    onClick = { viewModel.onEvent(AlertsUiEvent.FormChanged(f.copy(email = !f.email))) },
                    label = { Text("Email") }, modifier = Modifier.heightIn(min = 48.dp),
                )
            }
            if (state.freeCapReached && !editing) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.size(8.dp))
                    Text(
                        "Free plan: 1 alert used. Upgrade for unlimited.",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                    )
                    AssistChip(onClick = onUpgrade, label = { Text("Go Pro") })
                }
                Spacer(Modifier.height(8.dp))
            }
            if (editing) {
                PrimaryAction(
                    label = "Save changes",
                    onClick = { viewModel.onEvent(AlertsUiEvent.Update) },
                    loading = state.updating,
                )
                TextButton(
                    onClick = { viewModel.onEvent(AlertsUiEvent.CancelEdit) },
                    modifier = Modifier.heightIn(min = 48.dp).fillMaxWidth(),
                ) { Text("Cancel editing") }
            } else {
                PrimaryAction(
                    label = "Create alert",
                    onClick = { viewModel.onEvent(AlertsUiEvent.Create) },
                    loading = state.creating,
                    enabled = !state.freeCapReached,
                )
            }
        }
    }
}

@Composable
private fun AlertRow(
    alert: Alert,
    active: Boolean,
    toggling: Boolean,
    matches: List<AlertMatch>,
    onOpenDetail: (Int) -> Unit,
    onToggle: (Boolean) -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        Modifier.fillMaxWidth()
            .semantics { contentDescription = "Alert ${alert.title} under ${formatLkr(alert.maxPriceLkr)}" },
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    androidx.compose.material3.Text(
                        alert.title,
                        style = MaterialTheme.typography.titleSmall,
                    )
                    Text(
                        "${alert.district ?: "Any district"} · triggers ≤ ${formatLkr(alert.maxPriceLkr)} · ${alert.notifyChannels ?: "push"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(
                    checked = active,
                    onCheckedChange = onToggle,
                    enabled = !toggling,
                    modifier = Modifier.semantics {
                        contentDescription = if (active) "Deactivate alert" else "Activate alert"
                    },
                )
                IconButton(
                    onClick = onEdit,
                    modifier = Modifier.size(48.dp).semantics { contentDescription = "Edit alert" },
                ) {
                    Icon(Icons.Filled.Edit, contentDescription = null)
                }
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(48.dp).semantics { contentDescription = "Delete alert" },
                ) {
                    Icon(Icons.Filled.Delete, contentDescription = null)
                }
            }
            val flat = matches.flatMap { it.listings }.take(5)
            if (flat.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                SectionTitle("Matches (${flat.size})")
                flat.forEach { m ->
                    // % under the alert threshold — the "move" that triggered this match.
                    val underPct = if (m.priceLkr != null && (alert.maxPriceLkr ?: 0.0) > 0) {
                        (alert.maxPriceLkr!! - m.priceLkr) / alert.maxPriceLkr!! * 100
                    } else {
                        null
                    }
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                m.title ?: "${m.make} ${m.model}".trim(),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Text(
                                buildString {
                                    append(m.priceLkr?.let { formatLkr(it) } ?: "Price on request")
                                    append(" · ${m.district ?: "—"}")
                                    m.dealScore?.let { append(" · ★ %.1f".format(it)) }
                                    if (underPct != null && underPct >= 0) {
                                        append(" · ${formatPct(underPct, 0)} under max")
                                    }
                                },
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                        AssistChip(onClick = { onOpenDetail(m.id) }, label = { Text("View") })
                    }
                }
            } else if (!active) {
                Text(
                    "Paused — flip the switch to resume matching.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * Confetti-lite: exactly 12 dots bursting from centre. Static scatter under
 * reduced motion; no endless animation, auto-consumed by the screen.
 */
@Composable
private fun ConfettiLite(modifier: Modifier = Modifier) {
    val reduced = rememberReducedMotion()
    val progress by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(if (reduced) 0 else 900),
        label = "confetti",
    )
    val colors = remember {
        listOf(
            Color(0xFFC9A227), Color(0xFF2E7D32), Color(0xFF1565C0),
            Color(0xFFEF6C00), Color(0xFF6A1B9A), Color(0xFF00838F),
        )
    }
    Canvas(modifier.semantics { contentDescription = "Alert created celebration" }) {
        val cx = size.width / 2
        val cy = size.height / 2
        val radius = (size.minDimension / 2.4f) * progress
        repeat(12) { i ->
            val angle = (i * 30.0).let { Math.toRadians(it) }
            drawCircle(
                color = colors[i % colors.size],
                radius = 10f * (1 - progress * 0.4f),
                center = Offset(
                    cx + (radius * Math.cos(angle)).toFloat(),
                    cy + (radius * Math.sin(angle)).toFloat(),
                ),
            )
        }
    }
}
