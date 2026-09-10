package lk.motormila.app.ui.pulse

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.R
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.domain.model.MarketSignal
import lk.motormila.app.ui.components.BrandLogo
import lk.motormila.app.ui.components.BrandLogoSize
import lk.motormila.app.ui.components.ErrorState
import lk.motormila.app.ui.components.LoadingSkeletonCard
import lk.motormila.app.ui.theme.MotormilaBg
import lk.motormila.app.ui.theme.MotormilaOnSurface
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaSecondaryText
import lk.motormila.app.ui.theme.rememberHaptics

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfficialPulseDetailScreen(
    onBack: () -> Unit,
    onOpenUrl: (String) -> Unit,
    onOpenGuide: () -> Unit,
    viewModel: OfficialPulseDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val reducedMotion = rememberReducedMotion()
    val haptics = rememberHaptics()
    val backCd = stringResource(R.string.hub_back)

    Scaffold(
        containerColor = MotormilaBg,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BrandLogo(size = BrandLogoSize.COMPACT, showWordmark = false, showTagline = false)
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.hub_pulse_detail_title), fontWeight = FontWeight.Bold)
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
    ) { padding ->
        when {
            state.isLoading -> Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
                LoadingSkeletonCard()
            }
            state.error != null || state.signal == null -> ErrorState(
                message = state.error ?: stringResource(R.string.hub_pulse_detail_missing),
                onRetry = { viewModel.refresh() },
                modifier = Modifier.fillMaxSize().padding(padding),
            )
            else -> {
                val signal = state.signal!!
                val title = signalDetailTitle(signal)
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "${signal.source.replace('_', ' ')} · ${signal.signalType.replace('_', ' ')}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = MotormilaPrimaryBright,
                        ),
                    )
                    Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(
                        signalDetailValue(signal),
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                        ),
                    )
                    Text(
                        signal.observedAt.take(10),
                        style = MaterialTheme.typography.bodySmall,
                        color = MotormilaSecondaryText,
                    )
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(stringResource(R.string.hub_pulse_detail_metric), fontWeight = FontWeight.SemiBold)
                            Text(signal.metric.replace('_', ' '), color = MotormilaSecondaryText)
                        }
                    }
                    Button(
                        onClick = {
                            if (!reducedMotion) haptics.tick()
                            onOpenGuide()
                        },
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    ) {
                        Text(stringResource(R.string.hub_pulse_read_guides))
                    }
                    val url = signal.sourceUrl
                    if (!url.isNullOrBlank()) {
                        Button(
                            onClick = {
                                if (!reducedMotion) haptics.tick()
                                onOpenUrl(url)
                            },
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                        ) {
                            Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(stringResource(R.string.hub_pulse_open_source))
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

private fun signalDetailTitle(signal: MarketSignal): String {
    val fromCategory = signal.category?.trim().orEmpty()
    if (fromCategory.isNotEmpty()) return fromCategory
    val metric = signal.metric.replace('_', ' ').trim()
    if (metric.isNotEmpty()) return metric.replaceFirstChar { it.titlecase() }
    return signal.signalType.replace('_', ' ').replaceFirstChar { it.titlecase() }
}

private fun signalDetailValue(signal: MarketSignal): String {
    val value = signal.valueNumeric ?: return "N/A"
    val unit = signal.unit?.trim().orEmpty()
    if (unit.equals("lkr", ignoreCase = true) || signal.metric.contains("lkr", ignoreCase = true)) {
        return LkrFormat.full(value)
    }
    val number = if (value % 1.0 == 0.0) value.toLong().toString() else "%.1f".format(value)
    return if (unit.isBlank()) number else "$number $unit"
}
