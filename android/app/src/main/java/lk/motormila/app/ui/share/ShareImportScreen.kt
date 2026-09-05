package lk.motormila.app.ui.share

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import lk.motormila.app.core.ui.EmptyState
import lk.motormila.app.core.ui.PrimaryAction
import lk.motormila.app.domain.repository.ListingQuery

/**
 * Entry for `motormila://share-import/{url-encoded}`. Resolves the shared
 * marketplace URL and forwards exactly once to search / compare / FMV.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareImportScreen(
    sharedUrl: String?,
    onSearch: (ListingQuery) -> Unit,
    onCompare: (ids: List<Int>) -> Unit,
    onValuation: (make: String, model: String) -> Unit,
    onBrowse: () -> Unit,
) {
    val target = remember(sharedUrl) { parseSharedUrl(sharedUrl) }

    LaunchedEffect(target) {
        when (target) {
            is ShareTarget.Search -> onSearch(target.query)
            is ShareTarget.Compare -> onCompare(target.ids)
            is ShareTarget.Valuation -> onValuation(target.make, target.model)
            is ShareTarget.Unsupported -> Unit // stay: error state below
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Opening shared link") }) }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            when (target) {
                is ShareTarget.Unsupported -> EmptyState(
                    title = "Link not supported",
                    body = "We open ikman, Riyasewana and PatPat links. Got: ${(sharedUrl ?: "").take(80)}",
                    actionLabel = "Browse instead",
                    onAction = onBrowse,
                )
                else -> Card(
                    Modifier.semantics { contentDescription = "Resolving shared link" },
                ) {
                    Column(Modifier.padding(24.dp)) {
                        Text("Taking you to that vehicle…", style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            (sharedUrl ?: "").take(120),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(16.dp))
                        // Manual fallback if auto-nav was swallowed.
                        when (target) {
                            is ShareTarget.Search -> PrimaryAction("Open search", onClick = { onSearch(target.query) })
                            is ShareTarget.Compare -> PrimaryAction("Open compare", onClick = { onCompare(target.ids) })
                            is ShareTarget.Valuation -> PrimaryAction("Open valuation", onClick = {
                                onValuation(target.make, target.model)
                            })
                            else -> Unit
                        }
                    }
                }
            }
        }
    }
}
