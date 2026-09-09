package lk.motormila.app.work

import android.app.PendingIntent
import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit
import lk.motormila.app.core.notifications.NotificationHelper
import lk.motormila.app.data.local.db.MotormilaDatabase
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.fcm.listingTapPendingIntent

/**
 * Periodic alert matcher: reads cached alerts from Room, calls
 * POST /alerts/match, and posts a local notification per alert with new
 * matches. Tap opens [motormila://listing/{id}] when a match listing is
 * present, otherwise [motormila://watchlist]. Package is always set so the
 * tap stays inside this app.
 *
 * Schedule with [enqueue] (12 h interval + immediate one-shot,
 * network-required, exponential backoff); [cancel] on logout.
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
        const val UNIQUE_ONCE = "price_alert_sync_once"
        private const val NOTIF_ID_BASE = 10_000

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val wm = WorkManager.getInstance(context)
            val periodic = PeriodicWorkRequestBuilder<PriceAlertSyncWorker>(12, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .addTag(UNIQUE_NAME)
                .build()
            wm.enqueueUniquePeriodicWork(UNIQUE_NAME, ExistingPeriodicWorkPolicy.KEEP, periodic)
            val once = OneTimeWorkRequestBuilder<PriceAlertSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .addTag(UNIQUE_NAME)
                .build()
            wm.enqueueUniqueWork(UNIQUE_ONCE, ExistingWorkPolicy.KEEP, once)
        }

        fun cancel(context: Context) {
            val wm = WorkManager.getInstance(context)
            wm.cancelUniqueWork(UNIQUE_NAME)
            wm.cancelUniqueWork(UNIQUE_ONCE)
        }
    }

    override suspend fun doWork(): Result {
        val alerts = runCatching { db.alertDao().getAll().filter { it.active } }.getOrElse { emptyList() }
        if (alerts.isEmpty()) return Result.success()
        val match = runCatching { api.matchAlerts() }.getOrElse { return Result.retry() }
        match.results.forEach { row ->
            if (row.matchingCount <= 0 || alerts.none { it.id == row.alertId }) return@forEach
            val first = row.listings.firstOrNull()
            notifications.notifyPriceDrop(
                id = NOTIF_ID_BASE + row.alertId,
                title = "New match: ${listOfNotNull(row.make, row.model).joinToString(" ").ifBlank { "your alert" }}",
                body = "${row.matchingCount} matching listing(s)" +
                    (first?.let { " from Rs. ${"%,.0f".format(it.priceLkr ?: 0.0)}" } ?: ""),
                contentIntent = contentIntentOf(row.alertId, first?.id),
            )
        }
        return Result.success()
    }

    private fun contentIntentOf(alertId: Int, listingId: Int?): PendingIntent? =
        listingTapPendingIntent(applicationContext, listingId, alertId)
}
