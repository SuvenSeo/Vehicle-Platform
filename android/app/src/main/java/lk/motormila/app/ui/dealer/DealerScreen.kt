package lk.motormila.app.ui.dealer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.format.formatPct
import lk.motormila.app.core.ui.PrimaryAction
import lk.motormila.app.core.ui.SectionTitle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DealerScreen(
    onContactSupport: () -> Unit,
    viewModel: DealerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(DealerUiEvent.DismissError)
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Dealer tools") }) },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.claimToken == null) {
                item { ClaimForm(state, viewModel) }
            } else {
                item { ProfileCard(state, viewModel, onContactSupport) }
                item { BenchmarkCard(state, viewModel) }
                item { PlaybookCard() }
            }
        }
    }
}

@Composable
private fun ClaimForm(state: DealerUiState, viewModel: DealerViewModel) {
    val f = state.form
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            SectionTitle("Claim your dealership")
            DealerField("Display name", f.displayName) {
                viewModel.onEvent(DealerUiEvent.FormChanged(f.copy(displayName = it)))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DealerField("Phone", f.phone, Modifier.weight(1f)) {
                    viewModel.onEvent(DealerUiEvent.FormChanged(f.copy(phone = it)))
                }
                DealerField("Email", f.email, Modifier.weight(1f)) {
                    viewModel.onEvent(DealerUiEvent.FormChanged(f.copy(email = it)))
                }
            }
            DealerField("Stock pattern (e.g. Axio *)", f.pattern) {
                viewModel.onEvent(DealerUiEvent.FormChanged(f.copy(pattern = it)))
            }
            DealerField("Listing URL proving ownership", f.url) {
                viewModel.onEvent(DealerUiEvent.FormChanged(f.copy(url = it)))
            }
            Spacer(Modifier.height(8.dp))
            PrimaryAction("Claim dealership", onClick = { viewModel.onEvent(DealerUiEvent.Claim) }, loading = state.claiming)
        }
    }
}

@Composable
private fun ProfileCard(state: DealerUiState, viewModel: DealerViewModel, onContactSupport: () -> Unit) {
    Card(
        Modifier.fillMaxWidth()
            .semantics { contentDescription = "Claimed dealer ${state.claimedName}" },
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Verified, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Column(Modifier.weight(1f).padding(start = 8.dp)) {
                    Text(state.claimedName.ifBlank { "Claimed dealer" }, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Token ${state.claimToken?.take(8)}… · verified",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                TextButton(
                    onClick = { viewModel.onEvent(DealerUiEvent.SignOut) },
                    modifier = Modifier.heightIn(min = 48.dp),
                ) { Text("Release") }
            }
            TextButton(onClick = onContactSupport, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Something wrong? Contact support")
            }
        }
    }
}

@Composable
private fun BenchmarkCard(state: DealerUiState, viewModel: DealerViewModel) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            SectionTitle("Benchmark — paste listing URLs")
            OutlinedTextField(
                value = state.benchmarkUrls,
                onValueChange = { viewModel.onEvent(DealerUiEvent.BenchmarkUrlsChanged(it)) },
                label = { Text("One URL per line (ikman / riyasewana / patpat)") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            )
            Spacer(Modifier.height(8.dp))
            PrimaryAction("Run benchmark", onClick = { viewModel.onEvent(DealerUiEvent.RunBenchmark) }, loading = state.benchmarking)
            state.benchmark?.let { b ->
                Spacer(Modifier.height(12.dp))
                BenchmarkRow("Dealer", b.dealerName.ifBlank { "Your yard" })
                BenchmarkRow("Live listings", b.listingCount.toString())
                BenchmarkRow("Average", formatLkr(b.avgPriceLkr))
                BenchmarkRow("Median", formatLkr(b.medianPriceLkr))
                BenchmarkRow("District", b.district ?: "—")
                b.avgDealScore?.let { score ->
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Deal score ${formatPct(score, 1)} — per-URL breakdown arrives with yard-tools v2.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } ?: Text(
                    "URL-level breakdown arrives with yard-tools v2 — paste URLs above to queue them.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun BenchmarkRow(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp).heightIn(min = 48.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.titleSmall)
    }
}

@Composable
private fun PlaybookCard() {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            SectionTitle("Pricing playbook")
            listOf(
                "Price 3–5% under FMV for sub-14-day turns.",
                "Refresh photos + re-list every 21 days to reset velocity.",
                "Match the district median trim — over-specced stock sits.",
            ).forEach { tip -> Text("• $tip", style = MaterialTheme.typography.bodyMedium) }
        }
    }
}

@Composable
private fun DealerField(label: String, value: String, modifier: Modifier = Modifier, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        modifier = modifier.fillMaxWidth().heightIn(min = 48.dp).padding(vertical = 4.dp),
    )
}
