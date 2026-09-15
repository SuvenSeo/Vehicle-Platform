package lk.motormila.app.domain.repository

import lk.motormila.app.domain.model.AdminInviteRow
import lk.motormila.app.domain.model.AdminOverview
import lk.motormila.app.domain.model.AdminUserRow

interface AdminRepository {
    suspend fun overview(): AdminOverview
    suspend fun users(query: String? = null, limit: Int = 80): List<AdminUserRow>
    suspend fun invites(status: String? = "pending", limit: Int = 80): List<AdminInviteRow>
    suspend fun createInvite(email: String, plan: String, role: String = "user"): AdminInviteRow
    suspend fun revokeInvite(id: Int)
    suspend fun updateUserPlan(userId: Int, plan: String): AdminUserRow
}
