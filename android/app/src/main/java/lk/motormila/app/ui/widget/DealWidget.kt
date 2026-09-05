package lk.motormila.app.ui.widget

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.format.formatPct
import lk.motormila.app.domain.model.PulseSignal
import lk.motormila.app.domain.repository.InsightsRepository

/**
 * Deal-of-day + price-index widget — dependency-free path (no Glance dep added).
 *
 * - [DealWidgetWorker] refreshes [DealWidgetState] every 6h into DataStore.
 * - [DealWidgetContent] renders it; used as the Compose preview today and as
 *   the Glance `provideContent` body once the foundation adds Glance.
 *
 * Glance upgrade (gradle/manifest owner, no changes needed here besides the
 * receiver):
 * 1. add `androidx.glance:glance-appwidget` (+ `glance-material3`);
 * 2. add `DealWidgetReceiver : GlanceAppWidgetReceiver()` hosting a
 *    `GlanceAppWidget` whose `provideContent { DealWidgetContent(state) }`;
 * 3. call `enqueueDealWidgetRefresh(context)` from Application.onCreate.
 */
private val Context.widgetStore by preferencesDataStore("deal_widget")

private val IndexKey = stringPreferencesKey("index_label")
private val MomKey = stringPreferencesKey("mom_label")
private val DealTitleKey = stringPreferencesKey("deal_title")
private val DealPriceKey = longPreferencesKey("deal_price_lkr")

data class DealWidgetState(
    val indexLabel: String = "Index —",
    val momLabel: String = "",
    val dealTitle: String = "Deal of the day",
    val dealPriceLkr: Long? = null,
)

fun observeDealWidget(context: Context): Flow<DealWidgetState> =
    context.widgetStore.data.map { prefs ->
        DealWidgetState(
            indexLabel = prefs[IndexKey] ?: "Index —",
            momLabel = prefs[MomKey].orEmpty(),
            dealTitle = prefs[DealTitleKey] ?: "Deal of the day",
            dealPriceLkr = prefs[DealPriceKey],
        )
    }

@EntryPoint
@InstallIn(SingletonComponent::class)
interface DealWidgetEntryPoint {
    fun insightsRepository(): InsightsRepository
}

class DealWidgetWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return runCatching {
            val repo = EntryPointAccessors.fromApplication(
                applicationContext,
                DealWidgetEntryPoint::class.java,
            ).insightsRepository()
            val index = repo.index()
            val last = index.points.lastOrNull()
            val pulse: List<PulseSignal> = runCatching { repo.signals() }
                .getOrDefault(emptyList())
                .map {
                    PulseSignal(
                        id = it.id.toString(),
                        title = it.metric.ifBlank { it.signalType },
                        tag = it.source,
                        body = "${it.signalType} · ${it.valueNumeric?.toString().orEmpty()} ${it.unit.orEmpty()}".trim(),
                        timeLabel = it.observedAt.take(10),
                    )
                }
            applicationContext.widgetStore.edit { prefs ->
                prefs[IndexKey] = last?.let { "Index %.1f".format(it.indexValue) } ?: "Index —"
                prefs[MomKey] = last?.let {
                    val mom = it.momChangePct ?: 0.0
                    "${if (mom >= 0) "+" else ""}${formatPct(mom)} MoM"
                }.orEmpty()
                prefs[DealTitleKey] = pulse.firstOrNull()?.title ?: "Deal of the day"
            }
            // Deal price intentionally left for the Glance pass (needs listing repo join).
            Result.success()
        }.getOrElse { e ->
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}

fun enqueueDealWidgetRefresh(context: Context) {
    val request = PeriodicWorkRequestBuilder<DealWidgetWorker>(6, TimeUnit.HOURS)
        .addTag("deal_widget")
        .build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        "deal_widget_refresh",
        ExistingPeriodicWorkPolicy.KEEP,
        request,
    )
}

@Composable
fun DealWidgetContent(state: DealWidgetState, modifier: Modifier = Modifier) {
    Card(
        modifier.semantics {
            contentDescription = "Motormila ${state.indexLabel} ${state.momLabel}, ${state.dealTitle}"
        },
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(state.indexLabel, style = MaterialTheme.typography.titleSmall)
                Text(state.momLabel, style = MaterialTheme.typography.labelMedium)
            }
            Text(state.dealTitle, style = MaterialTheme.typography.bodyMedium, maxLines = 2)
            state.dealPriceLkr?.let {
                Text(formatLkr(it), style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun DealWidgetPreview() {
    DealWidgetContent(
        DealWidgetState(
            indexLabel = "Index 142.6",
            momLabel = "+1.2% MoM",
            dealTitle = "Axio 2017 · 6.8% under FMV · Colombo",
            dealPriceLkr = 7_850_000,
        ),
    )
}
