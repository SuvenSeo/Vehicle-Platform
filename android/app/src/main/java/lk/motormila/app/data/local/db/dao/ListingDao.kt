package lk.motormila.app.data.local.db.dao

import androidx.paging.PagingSource
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import lk.motormila.app.data.local.db.entity.ListingEntity

@Dao
interface ListingDao {
    @Query("SELECT * FROM listings WHERE id = :id")
    suspend fun getById(id: Int): ListingEntity?

    @Query("SELECT * FROM listings WHERE id = :id")
    fun observeById(id: Int): Flow<ListingEntity?>

    /**
     * Cached-paging stream. FTS is simple LIKE (no FTS4 table).
     * Pass "%" wildcards from the caller; NULL filter = match all.
     */
    @Query(
        """SELECT * FROM listings
        WHERE (:q IS NULL OR title LIKE :q OR make LIKE :q OR model LIKE :q)
        AND (:make IS NULL OR make LIKE '%' || :make || '%')
        AND (:district IS NULL OR district = :district)
        AND (:source IS NULL OR source = :source)
        ORDER BY cachedAtMs DESC""",
    )
    fun pagingByQuery(
        q: String?,
        make: String?,
        district: String?,
        source: String?,
    ): PagingSource<Int, ListingEntity>

    @Query("SELECT * FROM listings WHERE title LIKE '%' || :q || '%' OR make LIKE '%' || :q || '%' OR model LIKE '%' || :q || '%' ORDER BY cachedAtMs DESC LIMIT :limit")
    suspend fun search(q: String, limit: Int = 20): List<ListingEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<ListingEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(row: ListingEntity)

    @Query("DELETE FROM listings WHERE cachedAtMs < :olderThanMs")
    suspend fun pruneOlderThan(olderThanMs: Long): Int

    @Query("DELETE FROM listings")
    suspend fun clear()
}
