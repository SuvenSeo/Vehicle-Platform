package lk.motormila.app.ui.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Home-screen widget: daily best deal (priceDrops) + price index.
 * Swarm E owned. Updates are pushed by [DealWidgetWorker] (6h WorkManager);
 * [onUpdate] renders the cached DataStore state immediately and triggers a
 * refresh so the widget never looks empty.
 */
class DealWidgetProvider : AppWidgetProvider() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        scope.launch {
            runCatching {
                val state = context.widgetStorePublic().data.first().toWidgetState()
                updateAll(context, state, appWidgetIds)
            }
        }
        // Best-effort refresh (KEEP — no storm when several instances update).
        runCatching { enqueueDealWidgetRefresh(context) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        onUpdate(context, appWidgetManager, intArrayOf(appWidgetId))
    }

    companion object {
        /** Push [state] to specific instances (or all when [ids] is null). */
        fun updateAll(context: Context, state: DealWidgetState, ids: IntArray? = null) {
            val manager = AppWidgetManager.getInstance(context)
            val targets = ids ?: manager.getAppWidgetIds(
                android.content.ComponentName(context, DealWidgetProvider::class.java),
            )
            if (targets.isEmpty()) return
            val views = dealRemoteViews(context, state)
            targets.forEach { id ->
                runCatching { manager.updateAppWidget(id, views) }
            }
        }
    }
}
