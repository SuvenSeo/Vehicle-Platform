package lk.motormila.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Generic JSON cache for aggregate payloads (stats summary, snapshot, …).
 * Key examples: "stats_summary", "pro_snapshot". TTL enforced by readers
 * (default 15 min, see StatsRepositoryImpl).
 */
@Entity(tableName = "stats_cache")
data class StatsCacheEntity(
    @PrimaryKey val key: String,
    val json: String = "",
    val updatedAtMs: Long = 0L,
)
