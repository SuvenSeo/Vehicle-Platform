package lk.motormila.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "price_points",
    indices = [Index("listingId")],
)
data class PricePointEntity(
    @PrimaryKey(autoGenerate = true) val uid: Long = 0L,
    val listingId: Int = 0,
    val priceLkr: Double = 0.0,
    val scrapedAt: String = "",
)
