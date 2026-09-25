package lk.motormila.app.data.local.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import lk.motormila.app.data.local.db.entity.AlertEntity

@Dao
interface AlertDao {
    @Query("SELECT * FROM alerts ORDER BY id DESC")
    fun observeAll(): Flow<List<AlertEntity>>

    @Query("SELECT * FROM alerts ORDER BY id DESC")
    suspend fun getAll(): List<AlertEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<AlertEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(row: AlertEntity)

    @Query("UPDATE alerts SET active = :active, dirty = 1 WHERE id = :id")
    suspend fun setActive(id: Int, active: Boolean)

    @Query("DELETE FROM alerts WHERE id = :id")
    suspend fun delete(id: Int)

    @Query("DELETE FROM alerts")
    suspend fun clear()
}
