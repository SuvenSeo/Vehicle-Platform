package lk.motormila.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Cached listing row. Images stored as `||`-separated CSV (see ListingMappers). */
@Entity(tableName = "listings")
data class ListingEntity(
    @PrimaryKey val id: Int,
    val title: String = "",
    val make: String = "",
    val model: String = "",
    val year: Int? = null,
    val priceLkr: Double? = null,
    val mileageKm: Double? = null,
    val fuelType: String? = null,
    val transmission: String? = null,
    val condition: String? = null,
    val bodyType: String? = null,
    val district: String? = null,
    val city: String? = null,
    val source: String? = null,
    val thumbnailUrl: String? = null,
    val imagesCsv: String = "",
    val dealScore: Double? = null,
    val marketMedianLkr: Double? = null,
    val isActive: Boolean = true,
    val scrapedAt: String? = null,
    val firstSeenAt: String? = null,
    val lastSeenAt: String? = null,
    val detailUrl: String? = null,
    val externalUrl: String? = null,
    val engineCc: Double? = null,
    val cachedAtMs: Long = 0L,
)
