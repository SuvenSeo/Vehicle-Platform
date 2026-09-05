package lk.motormila.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "district_stats")
data class DistrictStatEntity(
    @PrimaryKey val district: String,
    val count: Int = 0,
    val avgPriceLkr: Double? = null,
    val medianPriceLkr: Double? = null,
    val cachedAtMs: Long = 0L,
)
