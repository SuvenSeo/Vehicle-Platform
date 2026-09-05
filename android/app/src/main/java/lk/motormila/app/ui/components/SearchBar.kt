package lk.motormila.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.domain.model.Listing

/**
 * Docked search field + suggestions dropdown + voice slot + recent searches.
 * Stateless: parent owns [query] and callbacks.
 */
@Composable
fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onSearch: (String) -> Unit,
    suggestions: List<Listing>,
    recentSearches: List<String>,
    onSuggestionClick: (Listing) -> Unit,
    onRecentClick: (String) -> Unit,
    onVoiceClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    showDropdown: Boolean = true,
) {
    Column(modifier = modifier.semantics { contentDescription = "Vehicle search" }) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            singleLine = true,
            shape = RoundedCornerShape(999.dp),
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            trailingIcon = {
                Row {
                    if (query.isNotBlank()) {
                        IconButton(
                            onClick = { onQueryChange("") },
                            modifier = Modifier.size(48.dp),
                        ) {
                            Icon(Icons.Filled.Clear, contentDescription = "Clear search")
                        }
                    }
                    if (onVoiceClick != null) {
                        IconButton(
                            onClick = onVoiceClick,
                            modifier = Modifier.size(48.dp),
                        ) {
                            Icon(Icons.Filled.Mic, contentDescription = "Voice search")
                        }
                    }
                }
            },
            placeholder = { Text("Search make, model… (e.g. Aqua G)") },
            modifier = Modifier.fillMaxWidth(),
        )
        if (showDropdown && (suggestions.isNotEmpty() || (query.isBlank() && recentSearches.isNotEmpty()))) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            ) {
                LazyColumn(modifier = Modifier.fillMaxWidth()) {
                    if (query.isBlank()) {
                        items(recentSearches.take(5)) { recent ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onRecentClick(recent) }
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Filled.History, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(Modifier.width(12.dp))
                                Text(recent, fontSize = 14.sp)
                            }
                        }
                    } else {
                        items(suggestions, key = { it.id }) { s ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSuggestionClick(s) }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                AsyncImage(
                                    model = s.thumbnailUrl,
                                    contentDescription = null,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(8.dp)),
                                )
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text("${s.make} ${s.model} ${s.year ?: ""}".trim(), fontSize = 14.sp)
                                    Text(
                                        s.formattedPrice(),
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
