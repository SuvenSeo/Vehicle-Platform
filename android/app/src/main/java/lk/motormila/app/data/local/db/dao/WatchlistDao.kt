package lk.motormila.app.data.local.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import lk.motormila.app.data.local.db.entity.WatchlistEntity

@Dao
interface WatchlistDao {
    @Query("SELECT * FROM watchlist ORDER BY addedAtMs DESC")
    fun observeAll(): Flow<List<WatchlistEntity>>

    @Query("SELECT EXISTS(SELECT 1 FROM watchlist WHERE listingId = :listingId)")
    fun isWatched(listingId: Int): Flow<Boolean>

    @Query("SELECT * FROM watchlist")
    suspend fun getAll(): List<WatchlistEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(row: WatchlistEntity)

    @Query("DELETE FROM watchlist WHERE listingId = :listingId")
    suspend fun delete(listingId: Int)

    @Query("DELETE FROM watchlist")
    suspend fun clear()
}
