package lk.motormila.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Offline mirror of a server alert. [dirty] marks local active-toggles that the
 * backend cannot persist yet (no PATCH /alerts) for reconciliation on refresh.
 */
@Entity(tableName = "alerts")
data class AlertEntity(
    @PrimaryKey val id: Int,
    val make: String? = null,
    val model: String? = null,
    val maxPriceLkr: Double? = null,
    val district: String? = null,
    val notifyPhone: String? = null,
    val notifyEmail: String? = null,
    val notifyTelegramChatId: String? = null,
    val notifyChannels: String? = null,
    val active: Boolean = true,
    val createdAt: String? = null,
    val dirty: Boolean = false,
)
