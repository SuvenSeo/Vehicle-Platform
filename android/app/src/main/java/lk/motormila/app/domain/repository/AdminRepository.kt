package lk.motormila.app.domain.repository

import lk.motormila.app.domain.model.AdminAnalytics
import lk.motormila.app.domain.model.AdminCacheClear
import lk.motormila.app.domain.model.AdminDealerRow
import lk.motormila.app.domain.model.AdminFeedbackItem
import lk.motormila.app.domain.model.AdminInviteRow
import lk.motormila.app.domain.model.AdminOverview
import lk.motormila.app.domain.model.AdminPermitRow
import lk.motormila.app.domain.model.AdminPipeline
import lk.motormila.app.domain.model.AdminPipelineTrigger
import lk.motormila.app.domain.model.AdminRevcarPilot
import lk.motormila.app.domain.model.AdminSystem
import lk.motormila.app.domain.model.AdminUserRow

interface AdminRepository {
    suspend fun overview(): AdminOverview
    suspend fun users(query: String? = null, plan: String? = null, limit: Int = 80): List<AdminUserRow>
    suspend fun invites(status: String? = "pending", limit: Int = 80): List<AdminInviteRow>
    suspend fun createInvite(email: String, plan: String, role: String = "user"): AdminInviteRow
    suspend fun revokeInvite(id: Int)
    suspend fun updateUserPlan(userId: Int, plan: String): AdminUserRow
    suspend fun updateUser(
        userId: Int,
        plan: String? = null,
        role: String? = null,
        isActive: Boolean? = null,
    ): AdminUserRow
    suspend fun pipeline(limit: Int = 50): AdminPipeline
    suspend fun triggerPipeline(job: String): AdminPipelineTrigger
    suspend fun analytics(): AdminAnalytics
    suspend fun feedback(limit: Int = 100, status: String? = null): List<AdminFeedbackItem>
    suspend fun updateFeedback(id: Int, status: String): AdminFeedbackItem
    suspend fun dealers(limit: Int = 100, status: String? = null): List<AdminDealerRow>
    suspend fun verifyDealer(id: Int): AdminDealerRow
    suspend fun adminPermits(): List<AdminPermitRow>
    suspend fun upsertPermit(name: String, type: String, price: Double): AdminPermitRow
    suspend fun system(): AdminSystem
    suspend fun clearCache(key: String? = null): AdminCacheClear
    suspend fun runRevcarPilot(): AdminRevcarPilot
}
