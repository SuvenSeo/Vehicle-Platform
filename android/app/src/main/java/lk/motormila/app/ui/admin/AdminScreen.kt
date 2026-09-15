package lk.motormila.app.ui.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.core.ui.ErrorRetry
import lk.motormila.app.core.ui.SkeletonList
import lk.motormila.app.ui.components.MotormilaEyebrow
import lk.motormila.app.ui.components.MotormilaGhostButton
import lk.motormila.app.ui.components.MotormilaMetricTile
import lk.motormila.app.ui.components.MotormilaPillTabs
import lk.motormila.app.ui.components.MotormilaPrimaryButton
import lk.motormila.app.ui.components.MotormilaSurface
import lk.motormila.app.ui.components.MotormilaTopBar
import lk.motormila.app.ui.theme.MotormilaGoodText
import lk.motormila.app.ui.theme.MotormilaOnSurface
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaSecondaryText

private val AdminTabs = listOf("Overview", "Invites", "Users")

@Composable
fun AdminScreen(
    onBack: () -> Unit,
    onLoginClick: () -> Unit,
    viewModel: AdminViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current

    Column(Modifier.fillMaxSize()) {
        MotormilaTopBar(title = "Admin", onBack = onBack)
        when {
            !state.isAdmin && !state.isLoading -> {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Admin only", fontWeight = FontWeight.SemiBold, fontSize = 22.sp, color = MotormilaOnSurface)
                    Text("Sign in with an admin account to invite users and manage plans.", color = MotormilaSecondaryText)
                    MotormilaPrimaryButton("Log in", onClick = onLoginClick)
                }
            }
            state.isLoading -> SkeletonList()
            state.error != null && state.overview == null ->
                ErrorRetry(state.error ?: "Error", onRetry = { viewModel.onEvent(AdminUiEvent.Refresh) })
            else -> {
                MotormilaPillTabs(
                    tabs = AdminTabs,
                    selected = state.tab,
                    onSelect = { viewModel.onEvent(AdminUiEvent.TabChanged(it)) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                when (state.tab) {
                    0 -> OverviewPane(state)
                    1 -> InvitesPane(state, viewModel, clipboard)
                    else -> UsersPane(state, viewModel)
                }
            }
        }
    }
}

@Composable
private fun OverviewPane(state: AdminUiState) {
    val overview = state.overview ?: return
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            MotormilaEyebrow("CONSOLE")
            Spacer(Modifier.height(8.dp))
            Text("Platform health", fontWeight = FontWeight.ExtraBold, fontSize = 26.sp, color = MotormilaOnSurface)
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MotormilaMetricTile("LIVE", LkrFormat.count(overview.listingsLive), modifier = Modifier.weight(1f))
                MotormilaMetricTile("USERS", LkrFormat.count(overview.usersTotal), modifier = Modifier.weight(1f))
                MotormilaMetricTile("PENDING", LkrFormat.count(overview.invitesPending), modifier = Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MotormilaMetricTile("FREE", LkrFormat.count(overview.usersFree), modifier = Modifier.weight(1f))
                MotormilaMetricTile("PRO", LkrFormat.count(overview.usersPro), modifier = Modifier.weight(1f))
                MotormilaMetricTile("ADMINS", LkrFormat.count(overview.usersAdmin), modifier = Modifier.weight(1f))
            }
        }
        if (overview.topMakes.isNotEmpty()) {
            item { Text("Top makes", fontWeight = FontWeight.SemiBold, color = MotormilaOnSurface) }
            items(overview.topMakes, key = { it.make }) { row ->
                MotormilaSurface {
                    Row(Modifier.fillMaxWidth()) {
                        Text(row.make, modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold, color = MotormilaOnSurface)
                        Text(LkrFormat.count(row.count), fontFamily = FontFamily.Monospace, color = MotormilaPrimaryBright)
                    }
                }
            }
        }
        if (overview.recentScrapes.isNotEmpty()) {
            item { Text("Recent scrapes", fontWeight = FontWeight.SemiBold, color = MotormilaOnSurface) }
            items(overview.recentScrapes, key = { it.id }) { run ->
                MotormilaSurface {
                    Text(run.source, fontWeight = FontWeight.SemiBold, color = MotormilaOnSurface)
                    Text(
                        "${run.status} · ${run.listingsFound} found · ${run.listingsNew} new",
                        fontSize = 12.sp,
                        color = MotormilaSecondaryText,
                    )
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun InvitesPane(
    state: AdminUiState,
    viewModel: AdminViewModel,
    clipboard: androidx.compose.ui.platform.ClipboardManager,
) {
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            MotormilaSurface {
                Text("Invite a user", fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = MotormilaOnSurface)
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = state.inviteEmail,
                    onValueChange = { viewModel.onEvent(AdminUiEvent.InviteEmailChanged(it)) },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("free", "pro", "dealer").forEach { plan ->
                        FilterChip(
                            selected = state.invitePlan == plan,
                            onClick = { viewModel.onEvent(AdminUiEvent.InvitePlanChanged(plan)) },
                            label = { Text(plan.uppercase()) },
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                MotormilaPrimaryButton(
                    if (state.sendingInvite) "Sending…" else "Send invite",
                    onClick = { viewModel.onEvent(AdminUiEvent.SendInvite) },
                    enabled = !state.sendingInvite,
                )
                if (state.lastInviteToken != null) {
                    Spacer(Modifier.height(10.dp))
                    Text("Invite token copied below — share the sign-up link.", fontSize = 12.sp, color = MotormilaGoodText)
                    Text(state.lastInviteToken, fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = MotormilaPrimaryBright)
                    Spacer(Modifier.height(8.dp))
                    MotormilaGhostButton("Copy token") {
                        clipboard.setText(AnnotatedString(state.lastInviteToken))
                    }
                }
                if (state.error != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(state.error, color = MotormilaPrimaryBright, fontSize = 12.sp)
                }
            }
        }
        items(state.invites, key = { it.id }) { invite ->
            MotormilaSurface {
                Text(invite.email, fontWeight = FontWeight.SemiBold, color = MotormilaOnSurface)
                Text(
                    "${invite.plan} · ${invite.status} · ${invite.role}",
                    fontSize = 12.sp,
                    color = MotormilaSecondaryText,
                )
                Spacer(Modifier.height(8.dp))
                MotormilaGhostButton("Revoke") { viewModel.onEvent(AdminUiEvent.RevokeInvite(invite.id)) }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun UsersPane(state: AdminUiState, viewModel: AdminViewModel) {
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(state.users, key = { it.id }) { user ->
            MotormilaSurface {
                Text(user.name.ifBlank { user.email }, fontWeight = FontWeight.SemiBold, color = MotormilaOnSurface)
                Text(user.email, fontSize = 12.sp, color = MotormilaSecondaryText)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("free", "pro", "dealer").forEach { plan ->
                        FilterChip(
                            selected = user.plan.equals(plan, true),
                            onClick = { viewModel.onEvent(AdminUiEvent.SetUserPlan(user.id, plan)) },
                            label = { Text(plan.uppercase()) },
                        )
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}
