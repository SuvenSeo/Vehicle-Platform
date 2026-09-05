package lk.motormila.app.ui.settings

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
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import lk.motormila.app.core.ui.PrimaryAction
import lk.motormila.app.core.ui.SectionTitle

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(
    onLoggedOut: () -> Unit,
    onOpenUrl: (url: String) -> Unit,
    /** Host wires BiometricPrompt; on success the toggle persists, on failure show message. */
    onBiometricVerify: (onSuccess: () -> Unit, onError: (String) -> Unit) -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val theme by viewModel.theme.collectAsStateWithLifecycle()
    val language by viewModel.language.collectAsStateWithLifecycle()
    val district by viewModel.defaultDistrict.collectAsStateWithLifecycle()
    val sort by viewModel.defaultSort.collectAsStateWithLifecycle()
    val biometric by viewModel.biometricEnabled.collectAsStateWithLifecycle()
    val baseUrl by viewModel.baseUrl.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(state.error) {
        state.error?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(SettingsUiEvent.DismissError)
        }
    }
    LaunchedEffect(state.feedbackSent) {
        if (state.feedbackSent) snacks.showSnackbar("Thanks — feedback sent.")
    }
    LaunchedEffect(state.loggedOut) {
        if (state.loggedOut) {
            viewModel.onEvent(SettingsUiEvent.ConsumeLoggedOut)
            onLoggedOut()
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Settings") }) },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                SectionTitle("Appearance")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("light", "dark", "system").forEach { t ->
                        FilterChip(
                            selected = theme == t,
                            onClick = { viewModel.onEvent(SettingsUiEvent.ThemeChanged(t)) },
                            label = { Text(t.replaceFirstChar { c -> c.uppercase() }) },
                            modifier = Modifier.heightIn(min = 48.dp),
                        )
                    }
                }
            }
            item {
                // Language stub: persists code + applies via AppCompatDelegate in MainActivity;
                // full si/ta strings arrive with the localisation pass.
                SectionTitle("Language (stub)")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("en" to "English", "si" to "සිංහල", "ta" to "தமிழ்").forEach { (code, label) ->
                        FilterChip(
                            selected = language == code,
                            onClick = { viewModel.onEvent(SettingsUiEvent.LanguageChanged(code)) },
                            label = { Text(label) },
                            modifier = Modifier.heightIn(min = 48.dp),
                        )
                    }
                }
            }
            item {
                SectionTitle("Defaults")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = district,
                        onValueChange = { viewModel.onEvent(SettingsUiEvent.DistrictChanged(it)) },
                        label = { Text("Default district") },
                        singleLine = true,
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                    )
                    OutlinedTextField(
                        value = sort,
                        onValueChange = { viewModel.onEvent(SettingsUiEvent.SortChanged(it)) },
                        label = { Text("Default sort") },
                        singleLine = true,
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                    )
                }
            }
            item {
                SectionTitle("Security")
                Card(Modifier.fillMaxWidth()) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp).heightIn(min = 48.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.Fingerprint, contentDescription = null)
                        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                            Text("Biometric unlock", style = MaterialTheme.typography.bodyLarge)
                            Text("Log in with fingerprint / face", style = MaterialTheme.typography.bodySmall)
                        }
                        Switch(
                            checked = biometric,
                            onCheckedChange = { enabled ->
                                if (enabled) {
                                    // Verify device credential before persisting the toggle.
                                    onBiometricVerify(
                                        { viewModel.onEvent(SettingsUiEvent.BiometricChanged(true)) },
                                        { msg -> scope.launch { snacks.showSnackbar(msg) } },
                                    )
                                } else {
                                    viewModel.onEvent(SettingsUiEvent.BiometricChanged(false))
                                }
                            },
                            modifier = Modifier.semantics { contentDescription = "Biometric unlock toggle" },
                        )
                    }
                }
            }
            item {
                SectionTitle("Developer")
                OutlinedTextField(
                    value = baseUrl,
                    onValueChange = { viewModel.onEvent(SettingsUiEvent.BaseUrlChanged(it)) },
                    label = { Text("API base URL override (blank = default)") },
                    singleLine = true,
                    supportingText = { Text("Debug builds only — honoured by the network module.") },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                )
                TextButton(
                    onClick = { viewModel.onEvent(SettingsUiEvent.ClearCache) },
                    modifier = Modifier.heightIn(min = 48.dp),
                ) {
                    Text(if (state.clearingCache) "Clearing…" else "Clear image + stats cache")
                }
            }
            item {
                SectionTitle("Feedback")
                OutlinedTextField(
                    value = state.feedbackDraft,
                    onValueChange = { viewModel.onEvent(SettingsUiEvent.FeedbackChanged(it)) },
                    label = { Text("What should we fix or build?") },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                )
                Spacer(Modifier.height(8.dp))
                PrimaryAction("Send feedback", onClick = { viewModel.onEvent(SettingsUiEvent.SendFeedback) }, loading = state.sendingFeedback)
            }
            item {
                SectionTitle("Legal")
                Row {
                    TextButton(
                        onClick = { onOpenUrl("https://motormila.vercel.app/privacy") },
                        modifier = Modifier.heightIn(min = 48.dp),
                    ) { Text("Privacy") }
                    TextButton(
                        onClick = { onOpenUrl("https://motormila.vercel.app/terms") },
                        modifier = Modifier.heightIn(min = 48.dp),
                    ) { Text("Terms") }
                }
            }
            item {
                PrimaryAction("Log out", onClick = { viewModel.onEvent(SettingsUiEvent.Logout) }, loading = state.loggingOut)
                Spacer(Modifier.height(8.dp))
                Text(
                    "Logging out cancels background sync and alert workers on this device.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
