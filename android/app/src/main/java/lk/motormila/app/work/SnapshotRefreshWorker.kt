package lk.motormila.app.work

import android.content.Context
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
import lk.motormila.app.data.local.db.MotormilaDatabase
import lk.motormila.app.data.local.db.entity.DistrictStatEntity
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.data.remote.mapper.toEntity

/**
 * Periodic snapshot refresher: warms district prices + price drops into Room
 * so the home screen renders instantly offline.
 * 6 h interval, network-required, exponential backoff.
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

        fun enqueue(context: Context) {
            val req = PeriodicWorkRequestBuilder<SnapshotRefreshWorker>(6, TimeUnit.HOURS)
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
