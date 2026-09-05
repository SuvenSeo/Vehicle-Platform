package lk.motormila.app.work

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit
import lk.motormila.app.core.notifications.NotificationHelper
import lk.motormila.app.data.local.db.MotormilaDatabase
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain

/**
 * Periodic alert matcher: reads cached alerts from Room, calls
 * POST /alerts/match, and posts a local notification per alert with new
 * matches (navigates to the alert detail route via [contentIntentOf]).
 *
 * Schedule with [enqueue] (12 h interval, network-required, exponential
 * backoff); [cancel] on logout.
 */
@HiltWorker
class PriceAlertSyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val api: MotormilaApiService,
    private val db: MotormilaDatabase,
    private val notifications: NotificationHelper,
) : CoroutineWorker(context, params) {

    companion object {
        const val UNIQUE_NAME = "price_alert_sync"
        private const val NOTIF_ID_BASE = 10_000

        fun enqueue(context: Context) {
            val req = PeriodicWorkRequestBuilder<PriceAlertSyncWorker>(12, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .addTag(UNIQUE_NAME)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(UNIQUE_NAME, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_NAME)
        }
    }

    override suspend fun doWork(): Result {
        val alerts = runCatching { db.alertDao().getAll().filter { it.active } }.getOrElse { emptyList() }
        if (alerts.isEmpty()) return Result.success()
        val match = runCatching { api.matchAlerts() }.getOrElse { return Result.retry() }
        var posted = 0
        match.results.forEach { row ->
            if (row.matchingCount <= 0 || alerts.none { it.id == row.alertId }) return@forEach
            val first = row.listings.firstOrNull()
            notifications.notifyPriceDrop(
                id = NOTIF_ID_BASE + row.alertId,
                title = "New match: ${listOfNotNull(row.make, row.model).joinToString(" ").ifBlank { "your alert" }}",
                body = "${row.matchingCount} matching listing(s)" +
                    (first?.let { " from Rs. ${"%,.0f".format(it.priceLkr ?: 0.0)}" } ?: ""),
                contentIntent = contentIntentOf(row.alertId),
            )
            posted++
        }
        return Result.success()
    }

    private fun contentIntentOf(alertId: Int): PendingIntent? = runCatching {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            `package` = applicationContext.packageName
            putExtra("alertId", alertId)
            putExtra("route", "alerts/$alertId")
        }
        PendingIntent.getActivity(
            applicationContext, alertId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }.getOrNull()
}
