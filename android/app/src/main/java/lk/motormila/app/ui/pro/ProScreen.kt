package lk.motormila.app.ui.pro

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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.format.formatPct
import lk.motormila.app.core.ui.ErrorRetry
import lk.motormila.app.core.ui.PrimaryAction
import lk.motormila.app.core.ui.SectionTitle
import lk.motormila.app.core.ui.SkeletonList
import lk.motormila.app.domain.model.ArbitrageGap
import lk.motormila.app.domain.model.ProDistrict
import lk.motormila.app.domain.model.VehicleLane

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ProScreen(
    onOpenCheckout: (url: String) -> Unit,
    onOpenDistrict: (district: String) -> Unit,
    viewModel: ProViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    var paywallOpen by remember { mutableStateOf(false) }

    LaunchedEffect(state.error) {
        state.error?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(ProUiEvent.DismissError)
        }
    }
    LaunchedEffect(state.checkoutUrl) {
        state.checkoutUrl?.let { onOpenCheckout(it) }
    }
    // Non-Pro users land on the paywall sheet (dismissible to peek blurred previews).
    LaunchedEffect(state.isPro, state.isLoading) {
        if (!state.isLoading && !state.isPro) paywallOpen = true
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Pro intelligence") }) },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = false,
            onRefresh = { viewModel.onEvent(ProUiEvent.Refresh) },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when {
                state.isLoading -> SkeletonList()
                state.error != null && state.snapshot == null && state.isPro ->
                    ErrorRetry(state.error ?: "Error", onRetry = { viewModel.onEvent(ProUiEvent.Refresh) })

                else -> ProContent(
                    state = state,
                    blurred = !state.isPro,
                    onOpenDistrict = onOpenDistrict,
                    onUpgrade = { paywallOpen = true },
                )
            }
        }

        if (paywallOpen && !state.isPro) {
            ModalBottomSheet(
                onDismissRequest = { paywallOpen = false },
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(24.dp)
                        .semantics { contentDescription = "Pro paywall" },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Filled.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(8.dp))
                    Text("Motormila Pro", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Snapshots, lane velocity, district arbitrage and source-quality scores. " +
                            "Blurred previews above — unlock to trade on them.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(Modifier.height(16.dp))
                    // Blur-locked preview strip inside the sheet itself.
                    BlurredPreview()
                    Spacer(Modifier.height(16.dp))
                    PrimaryAction("Continue to checkout", onClick = { viewModel.onEvent(ProUiEvent.CheckoutIntent) })
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProContent(
    state: ProUiState,
    blurred: Boolean,
    onOpenDistrict: (String) -> Unit,
    onUpgrade: () -> Unit,
) {
    // When blurred, show deterministic placeholder snapshot so the paywall has
    // something to lock; real values arrive post-upgrade via Refresh.
    val snap = state.snapshot
    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            SectionTitle("Snapshot KPIs · ${state.planName}")
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = if (blurred) Modifier.blur(10.dp) else Modifier,
            ) {
                if (snap != null) {
                    KpiChip("Listings", snap.totalListings.toString())
                    KpiChip("Avg", formatLkr(snap.avgPriceLkr))
                    KpiChip("Median", formatLkr(snap.medianPriceLkr))
                    KpiChip("New 7d", snap.newListings7d.toString())
                    KpiChip("Hot deals", snap.hotDealCount.toString())
                    KpiChip("Districts", snap.districtsCovered.toString())
                } else {
                    Text("Upgrade to load live KPIs.", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item { SectionTitle("Lanes") }
        val lanes: List<VehicleLane> = state.lanes
        if (lanes.isEmpty() && !blurred) {
            item { Text("No lane data yet.", style = MaterialTheme.typography.bodyMedium) }
        } else {
            items((lanes.ifEmpty { previewLanes() })) { lane ->
                val laneName = "${lane.make} ${lane.model}".trim().ifBlank { "Lane" }
                Card(
                    Modifier.fillMaxWidth()
                        .then(if (blurred) Modifier.blur(10.dp) else Modifier),
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp).heightIn(min = 48.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(laneName, style = MaterialTheme.typography.titleSmall)
                            Text(
                                "${lane.listingCount} listings · median ${formatLkr(lane.medianPriceLkr)}",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Text(
                            lane.avgDealScore?.let { "★ %.1f".format(it) }
                                ?: (lane.topDistrict ?: ""),
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }
        item { SectionTitle("Districts") }
        val districts: List<ProDistrict> = state.districts
        if (districts.isEmpty() && !blurred) {
            item { Text("No district data yet.", style = MaterialTheme.typography.bodyMedium) }
        } else {
            items(districts.ifEmpty { if (blurred) previewDistricts() else emptyList() }) { d ->
                Card(
                    onClick = { onOpenDistrict(d.district) },
                    modifier = Modifier.fillMaxWidth().then(if (blurred) Modifier.blur(10.dp) else Modifier),
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp).heightIn(min = 48.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(d.district, style = MaterialTheme.typography.bodyLarge)
                        Text(
                            "${d.listingCount} · median ${formatLkr(d.medianPriceLkr)}",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }
        item { SectionTitle("Arbitrage pairs") }
        val arb: List<ArbitrageGap> = state.arbitrage
        if (arb.isEmpty() && !blurred) {
            item { Text("No arbitrage gaps for your scope yet.", style = MaterialTheme.typography.bodyMedium) }
        } else {
            items(arb.ifEmpty { if (blurred) previewArb() else emptyList() }) { a ->
                Card(Modifier.fillMaxWidth().then(if (blurred) Modifier.blur(10.dp) else Modifier)) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "Buy ${a.buyDistrict} → sell ${a.sellDistrict}",
                            style = MaterialTheme.typography.bodyLarge,
                        )
                        Text(
                            "Spread ${formatLkr(a.sellMedianLkr - a.buyMedianLkr)} · ${formatPct(a.gapPct)}",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }
        item { SectionTitle("Source quality") }
        if (blurred) {
            // Static blurred placeholders: per-lane source mix has no ProRepository
            // surface in this build, so free-tier users see locked preview cards.
            items(previewSourceLabels()) { label ->
                Card(Modifier.fillMaxWidth().blur(10.dp)) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp).heightIn(min = 48.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(label, style = MaterialTheme.typography.bodyLarge)
                        Text("PRO", style = MaterialTheme.typography.titleSmall)
                    }
                }
            }
        } else {
            item {
                Text(
                    "Source-quality scores live in the Insights feed in this build.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        if (blurred) {
            item {
                PrimaryAction("Unlock Pro", onClick = onUpgrade)
            }
        }
    }
}

@Composable
private fun BlurredPreview() {
    Card(Modifier.fillMaxWidth().blur(8.dp).semantics { contentDescription = "Locked Pro preview" }) {
        Column(Modifier.padding(16.dp)) {
            Text("DEAL RADAR · ▓▓▓▓", style = MaterialTheme.typography.titleSmall)
            Text("Spread ▓▓▓▓ · ▓▓ district", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun KpiChip(label: String, value: String) {
    AssistChip(onClick = {}, label = { Text("$label: $value") })
}

private fun previewLanes() = listOf(
    VehicleLane(
        make = "Toyota", model = "Axio", listingCount = 214,
        avgPriceLkr = 8_450_000.0, medianPriceLkr = 8_450_000.0,
        minPriceLkr = null, maxPriceLkr = null, avgDealScore = 7.5,
        districtCount = 3, sourceCount = 2, topDistrict = "Colombo",
        topSource = "ikman", latestSeenAt = null,
    ),
    VehicleLane(
        make = "Toyota", model = "Aqua", listingCount = 167,
        avgPriceLkr = 6_900_000.0, medianPriceLkr = 6_900_000.0,
        minPriceLkr = null, maxPriceLkr = null, avgDealScore = 6.8,
        districtCount = 2, sourceCount = 2, topDistrict = "Gampaha",
        topSource = "riyasewana", latestSeenAt = null,
    ),
)

private fun previewDistricts() = listOf(
    ProDistrict(
        district = "Colombo", listingCount = 1204,
        avgPriceLkr = 9_100_000.0, medianPriceLkr = 8_750_000.0,
        minPriceLkr = null, maxPriceLkr = null, sourceCount = 3,
        topMake = "Toyota", topModel = "Axio", latestSeenAt = null,
    ),
    ProDistrict(
        district = "Gampaha", listingCount = 986,
        avgPriceLkr = 7_400_000.0, medianPriceLkr = 7_100_000.0,
        minPriceLkr = null, maxPriceLkr = null, sourceCount = 3,
        topMake = "Toyota", topModel = "Aqua", latestSeenAt = null,
    ),
)

private fun previewArb() = listOf(
    ArbitrageGap(
        buyDistrict = "Kurunegala", sellDistrict = "Colombo",
        buyMedianLkr = 7_800_000.0, sellMedianLkr = 8_250_000.0,
        gapPct = 5.8, buyListingCount = 42, sellListingCount = 214,
    ),
)

private fun previewSourceLabels() = listOf("ikman · 1,204", "riyasewana · 986")
