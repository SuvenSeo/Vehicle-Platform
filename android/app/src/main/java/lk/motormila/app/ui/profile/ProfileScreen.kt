package lk.motormila.app.ui.profile

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.R
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.core.ui.ErrorRetry
import lk.motormila.app.core.ui.SectionTitle
import lk.motormila.app.core.ui.SkeletonList
import lk.motormila.app.ui.components.OfflineBanner
import lk.motormila.app.ui.theme.rememberHaptics

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(
    onLoginClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onProClick: () -> Unit,
    onDealerClick: () -> Unit,
    onAlertsClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    onEvHubClick: () -> Unit = {},
    onPulseClick: () -> Unit = {},
    onBestPicksClick: () -> Unit = {},
    onCalculatorClick: () -> Unit = {},
    onCompareClick: () -> Unit = {},
    onTrendsClick: () -> Unit = {},
    onDocsClick: () -> Unit = {},
    onPricingClick: () -> Unit = {},
    onPermitsClick: () -> Unit = {},
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    val reducedMotion = rememberReducedMotion()
    val haptics = rememberHaptics()

    fun navTap(onClick: () -> Unit) {
        if (!reducedMotion) haptics.tick()
        onClick()
    }

    LaunchedEffect(state.error) {
        state.error?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(ProfileUiEvent.DismissError)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    lk.motormila.app.ui.components.BrandLogo(
                        size = lk.motormila.app.ui.components.BrandLogoSize.NAV,
                        showWordmark = true,
                        showTagline = false,
                    )
                },
            )
        },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = { viewModel.onEvent(ProfileUiEvent.Refresh) },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when {
                state.isLoading -> SkeletonList(rows = 4)
                state.error != null && state.profile == null ->
                    ErrorRetry(state.error ?: "Error", onRetry = { viewModel.onEvent(ProfileUiEvent.Refresh) })

                state.profile == null -> ErrorRetry("Couldn't load profile.", onRetry = { viewModel.onEvent(ProfileUiEvent.Refresh) })

                else -> {
                    val p = state.profile!!
                    LazyColumn(
                        Modifier.fillMaxSize().padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        item { OfflineBanner(visible = state.offline) }
                        item {
                            // Session card + plan badge + role/admin affordance
                            Card(
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(28.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, lk.motormila.app.ui.theme.MotormilaOutline),
                                colors = androidx.compose.material3.CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surface,
                                ),
                                modifier = Modifier.fillMaxWidth()
                                    .semantics { contentDescription = "${p.sessionState} session for ${p.displayName}, plan ${p.planName}, role ${p.role}" },
                            ) {
                                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                                    Row(
                                        Modifier.fillMaxWidth().heightIn(min = 48.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Column(Modifier.weight(1f)) {
                                            Text(p.displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                            Text(p.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            Text(
                                                "${p.sessionState} · ${p.role.replaceFirstChar { c -> c.uppercase() }}" +
                                                    (p.expiresAt?.let { " · expires ${it.take(10)}" } ?: ""),
                                                style = MaterialTheme.typography.labelMedium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                        AssistChip(
                                            onClick = { navTap(onProClick) },
                                            colors = androidx.compose.material3.AssistChipDefaults.assistChipColors(
                                                containerColor = androidx.compose.ui.graphics.Color(0x2E0A7AFF),
                                                labelColor = lk.motormila.app.ui.theme.MotormilaPrimaryBright,
                                            ),
                                            border = androidx.compose.material3.AssistChipDefaults.assistChipBorder(
                                                enabled = true,
                                                borderColor = androidx.compose.ui.graphics.Color(0x550A7AFF),
                                            ),
                                            label = {
                                                Text(
                                                    p.planName.uppercase(),
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontSize = 11.sp,
                                                )
                                            },
                                        )
                                    }
                                    if (p.isAdmin) {
                                        Spacer(Modifier.height(8.dp))
                                        AssistChip(
                                            onClick = { navTap(onSettingsClick) },
                                            label = { Text("ADMIN — manage invites in /admin") },
                                            leadingIcon = {
                                                Icon(
                                                    Icons.Filled.EmojiEvents,
                                                    contentDescription = null,
                                                    tint = lk.motormila.app.ui.theme.MotormilaPrimaryBright,
                                                )
                                            },
                                            modifier = Modifier.heightIn(min = 48.dp)
                                                .semantics { contentDescription = "Admin controls" },
                                        )
                                    }
                                }
                            }
                        }
                        item {
                            // Watchlist / alert counts
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Card(
                                    shape = androidx.compose.foundation.shape.RoundedCornerShape(28.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, lk.motormila.app.ui.theme.MotormilaOutline),
                                    colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Column(Modifier.padding(16.dp)) {
                                        Text("${p.watchlistCount}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                        Text("Watched", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                                Card(
                                    shape = androidx.compose.foundation.shape.RoundedCornerShape(28.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, lk.motormila.app.ui.theme.MotormilaOutline),
                                    colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Column(Modifier.padding(16.dp)) {
                                        Text("${p.alertCount}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                        Text("Alerts", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                        item {
                            // Deal-hunter score + streaks
                            Card(
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(28.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, lk.motormila.app.ui.theme.MotormilaOutline),
                                colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(Modifier.padding(16.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Filled.EmojiEvents, contentDescription = null, tint = lk.motormila.app.ui.theme.MotormilaPrimaryBright)
                                        Text(" Deal-hunter ${p.dealHunterScore}/100", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    LinearProgressIndicator(
                                        progress = { (p.dealHunterScore / 100f).coerceIn(0f, 1f) },
                                        color = lk.motormila.app.ui.theme.MotormilaPrimary,
                                        trackColor = androidx.compose.ui.graphics.Color(0x22FFFFFF),
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                    Spacer(Modifier.height(8.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Filled.LocalFireDepartment, contentDescription = null)
                                        Text(" ${p.streakDays}-day streak", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                        item {
                            SectionTitle("Badges")
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                p.badges.forEach { b ->
                                    AssistChip(
                                        onClick = {},
                                        label = { Text("${if (b.earned) "★ " else "☆ "}${b.label}") },
                                        modifier = Modifier.heightIn(min = 48.dp),
                                    )
                                }
                            }
                        }
                        item {
                            SectionTitle(stringResource(R.string.hub_profile_section))
                            TileRow(
                                label = stringResource(R.string.hub_ev_title),
                                onClick = { navTap(onEvHubClick) },
                            )
                            TileRow(
                                label = stringResource(R.string.hub_pulse_title),
                                onClick = { navTap(onPulseClick) },
                            )
                            TileRow(
                                label = stringResource(R.string.hub_picks_title),
                                onClick = { navTap(onBestPicksClick) },
                            )
                            TileRow(
                                label = stringResource(R.string.hub_calc_title),
                                onClick = { navTap(onCalculatorClick) },
                                openDescription = stringResource(R.string.hub_open_calc),
                            )
                            TileRow(
                                label = stringResource(R.string.hub_compare_title),
                                onClick = { navTap(onCompareClick) },
                            )
                            TileRow(
                                label = stringResource(R.string.hub_trends_title),
                                onClick = { navTap(onTrendsClick) },
                            )
                            TileRow(
                                label = stringResource(R.string.hub_permits_title),
                                onClick = { navTap(onPermitsClick) },
                            )
                            TileRow(
                                label = stringResource(R.string.hub_docs_title),
                                onClick = { navTap(onDocsClick) },
                            )
                            TileRow(
                                label = stringResource(R.string.hub_pricing_title),
                                onClick = { navTap(onPricingClick) },
                            )
                        }
                        item {
                            SectionTitle("Manage")
                            TileRow("Settings", onClick = { navTap(onSettingsClick) })
                            TileRow(if (p.planName.equals("Pro", true)) "Pro dashboard" else "Go Pro", onClick = { navTap(onProClick) })
                            TileRow("Dealer tools", onClick = { navTap(onDealerClick) })
                            TileRow("Price alerts", onClick = { navTap(onAlertsClick) })
                            TileRow("Notifications", onClick = { navTap(onNotificationsClick) })
                            if (!p.loggedIn) TileRow("Log in / sign up", onClick = { navTap(onLoginClick) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TileRow(
    label: String,
    onClick: () -> Unit,
    openDescription: String? = null,
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
            .semantics { contentDescription = openDescription ?: "Open $label" },
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp).heightIn(min = 48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            IconButton(onClick = onClick, modifier = Modifier.heightIn(min = 48.dp)) {
                Icon(Icons.Filled.ChevronRight, contentDescription = null)
            }
        }
    }
}
