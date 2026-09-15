package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.AdminInviteCreateDto
import lk.motormila.app.data.remote.dto.AdminInviteDto
import lk.motormila.app.data.remote.dto.AdminUserDto
import lk.motormila.app.data.remote.dto.AdminUserUpdateDto
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.AdminInviteRow
import lk.motormila.app.domain.model.AdminMakeCount
import lk.motormila.app.domain.model.AdminOverview
import lk.motormila.app.domain.model.AdminScrapeRun
import lk.motormila.app.domain.model.AdminUserRow
import lk.motormila.app.domain.repository.AdminRepository

@Singleton
class AdminRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    @IoDispatcher private val io: CoroutineDispatcher,
) : AdminRepository {

    override suspend fun overview(): AdminOverview = withContext(io) {
        val dto = api.adminOverview()
        AdminOverview(
            listingsTotal = dto.listings.total,
            listingsLive = dto.listings.live,
            usersTotal = dto.users.total,
            usersFree = dto.users.free,
            usersPro = dto.users.pro,
            usersAdmin = dto.users.admins,
            invitesPending = dto.invites.pending,
            feedbackOpen = dto.feedback.open,
            dealersVerified = dto.dealers.verified,
            generatedAt = dto.generatedAt,
            topMakes = dto.topMakes.map { AdminMakeCount(it.make.orEmpty().ifBlank { "—" }, it.count) },
            recentScrapes = dto.recentScrapes.map {
                AdminScrapeRun(
                    id = it.id,
                    source = it.source,
                    status = it.status,
                    listingsFound = it.listingsFound,
                    listingsNew = it.listingsNew,
                    startedAt = it.startedAt,
                )
            },
        )
    }

    override suspend fun users(query: String?, limit: Int): List<AdminUserRow> = withContext(io) {
        api.adminUsers(q = query?.takeIf { it.isNotBlank() }, limit = limit).users.map { it.toDomain() }
    }

    override suspend fun invites(status: String?, limit: Int): List<AdminInviteRow> = withContext(io) {
        api.adminInvites(status = status, limit = limit).invites.map { it.toDomain() }
    }

    override suspend fun createInvite(email: String, plan: String, role: String): AdminInviteRow =
        withContext(io) {
            api.createAdminInvite(AdminInviteCreateDto(email = email.trim(), plan = plan, role = role)).toDomain()
        }

    override suspend fun revokeInvite(id: Int) = withContext(io) {
        api.revokeAdminInvite(id)
        Unit
    }

    override suspend fun updateUserPlan(userId: Int, plan: String): AdminUserRow = withContext(io) {
        api.updateAdminUser(userId, AdminUserUpdateDto(plan = plan)).toDomain()
    }
}

private fun AdminUserDto.toDomain() = AdminUserRow(
    id = id,
    email = email,
    name = name,
    plan = plan,
    subscriptionStatus = subscriptionStatus,
    role = role,
    isActive = isActive,
    createdAt = createdAt,
)

private fun AdminInviteDto.toDomain() = AdminInviteRow(
    id = id,
    email = email,
    plan = plan,
    role = role,
    status = status,
    token = token,
    signupPath = signupPath,
    expiresAt = expiresAt,
    emailSent = emailSent,
)
