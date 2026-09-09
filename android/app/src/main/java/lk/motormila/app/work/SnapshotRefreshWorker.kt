package lk.motormila.app.work

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
import lk.motormila.app.data.local.db.MotormilaDatabase
import lk.motormila.app.data.local.db.entity.DistrictStatEntity
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.data.remote.mapper.toEntity

/**
 * Periodic snapshot refresher: warms district prices + price drops into Room
 * so the home screen renders instantly offline.
 * 6 h interval + immediate one-shot, network-required, exponential backoff.
 */
@HiltWorker
class SnapshotRefreshWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val api: MotormilaApiService,
    private val db: MotormilaDatabase,
) : CoroutineWorker(context, params) {

    companion object {
        const val UNIQUE_NAME = "snapshot_refresh"
        const val UNIQUE_ONCE = "snapshot_refresh_once"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val wm = WorkManager.getInstance(context)
            val periodic = PeriodicWorkRequestBuilder<SnapshotRefreshWorker>(6, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .addTag(UNIQUE_NAME)
                .build()
            wm.enqueueUniquePeriodicWork(UNIQUE_NAME, ExistingPeriodicWorkPolicy.KEEP, periodic)
            val once = OneTimeWorkRequestBuilder<SnapshotRefreshWorker>()
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
        return try {
            val now = System.currentTimeMillis()
            runCatching {
                val districts = api.districtPrices().points
                db.statsCacheDao().upsertDistricts(
                    districts.map {
                        DistrictStatEntity(it.district, it.count, it.avgPriceLkr, it.medianPriceLkr, now)
                    },
                )
            }
            runCatching {
                val drops = api.getPriceDrops(7)
                db.listingDao().upsertAll(drops.items.map { it.listing.toDomain().toEntity(now) })
            }
            runCatching { db.listingDao().pruneOlderThan(now - TimeUnit.DAYS.toMillis(2)) }
            Result.success()
        } catch (t: Throwable) {
            if (runAttemptCount >= 3) Result.failure() else Result.retry()
        }
    }
}
