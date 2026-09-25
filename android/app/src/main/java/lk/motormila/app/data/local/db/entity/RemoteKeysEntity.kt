package lk.motormila.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Paging remote keys, one row per cached query (queryHash = stable hash of
 * ListingQuery). RemoteMediator refresh invalidates by queryHash.
 */
@Entity(tableName = "remote_keys")
data class RemoteKeysEntity(
    @PrimaryKey val queryHash: String,
    val prevPage: Int? = null,
    val nextPage: Int? = null,
    val updatedAtMs: Long = 0L,
)
