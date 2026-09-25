package lk.motormila.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Local watchlist entry backing domain WatchItem. Room v1 fresh — new columns have defaults. */
@Entity(tableName = "watchlist")
data class WatchlistEntity(
    @PrimaryKey val listingId: Int,
    val title: String = "",
    val thumbnailUrl: String? = null,
    val priceAtAddLkr: Double? = null,
    val lastKnownPriceLkr: Double? = null,
    val addedAtMs: Long = 0L,
    val district: String? = null,
    val fmvLkr: Double? = null,
    val underFmv: Double? = null,
)
