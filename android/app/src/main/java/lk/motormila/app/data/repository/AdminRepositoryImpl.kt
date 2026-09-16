package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.AdminAnalyticsDto
import lk.motormila.app.data.remote.dto.AdminCacheClearDto
import lk.motormila.app.data.remote.dto.AdminDealerDto
import lk.motormila.app.data.remote.dto.AdminFeedbackDto
import lk.motormila.app.data.remote.dto.AdminFeedbackUpdateDto
import lk.motormila.app.data.remote.dto.AdminFlagDto
import lk.motormila.app.data.remote.dto.AdminInviteCreateDto
import lk.motormila.app.data.remote.dto.AdminInviteDto
import lk.motormila.app.data.remote.dto.AdminNamedCountDto
import lk.motormila.app.data.remote.dto.AdminPermitDto
import lk.motormila.app.data.remote.dto.AdminPermitUpsertDto
import lk.motormila.app.data.remote.dto.AdminPipelineResponseDto
import lk.motormila.app.data.remote.dto.AdminPipelineRunDto
import lk.motormila.app.data.remote.dto.AdminPipelineTriggerDto
import lk.motormila.app.data.remote.dto.AdminPipelineTriggerRequestDto
import lk.motormila.app.data.remote.dto.AdminProviderDto
import lk.motormila.app.data.remote.dto.AdminRevcarPilotDto
import lk.motormila.app.data.remote.dto.AdminSystemDto
import lk.motormila.app.data.remote.dto.AdminUserDto
import lk.motormila.app.data.remote.dto.AdminUserUpdateDto
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.AdminAnalytics
import lk.motormila.app.domain.model.AdminAnalyticsAlerts
import lk.motormila.app.domain.model.AdminAnalyticsListings
import lk.motormila.app.domain.model.AdminAnalyticsScrapes
import lk.motormila.app.domain.model.AdminAnalyticsSignals
import lk.motormila.app.domain.model.AdminAnalyticsUsers
import lk.motormila.app.domain.model.AdminCacheClear
import lk.motormila.app.domain.model.AdminDealerRow
import lk.motormila.app.domain.model.AdminFeedbackItem
import lk.motormila.app.domain.model.AdminFlagSet
import lk.motormila.app.domain.model.AdminInviteRow
import lk.motormila.app.domain.model.AdminMakeCount
import lk.motormila.app.domain.model.AdminNamedCount
import lk.motormila.app.domain.model.AdminOverview
import lk.motormila.app.domain.model.AdminPermitRow
import lk.motormila.app.domain.model.AdminPipeline
import lk.motormila.app.domain.model.AdminPipelineRun
import lk.motormila.app.domain.model.AdminPipelineTrigger
import lk.motormila.app.domain.model.AdminProvider
import lk.motormila.app.domain.model.AdminRevcarPilot
import lk.motormila.app.domain.model.AdminScrapeRun
import lk.motormila.app.domain.model.AdminSystem
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

    override suspend fun users(query: String?, plan: String?, limit: Int): List<AdminUserRow> =
        withContext(io) {
            api.adminUsers(
                q = query?.takeIf { it.isNotBlank() },
                plan = plan?.takeIf { it.isNotBlank() },
                limit = limit,
            ).users.map { it.toDomain() }
        }

    override suspend fun invites(status: String?, limit: Int): List<AdminInviteRow> = withContext(io) {
        api.adminInvites(status = status, limit = limit).invites.map { it.toDomain() }
    }

    override suspend fun createInvite(email: String, plan: String, role: String): AdminInviteRow =
        withContext(io) {
            api.createAdminInvite(
                AdminInviteCreateDto(email = email.trim(), plan = plan, role = role),
            ).toDomain()
        }

    override suspend fun revokeInvite(id: Int) = withContext(io) {
        api.revokeAdminInvite(id)
        Unit
    }

    override suspend fun updateUserPlan(userId: Int, plan: String): AdminUserRow =
        updateUser(userId = userId, plan = plan)

    override suspend fun updateUser(
        userId: Int,
        plan: String?,
        role: String?,
        isActive: Boolean?,
    ): AdminUserRow = withContext(io) {
        api.updateAdminUser(
            userId,
            AdminUserUpdateDto(plan = plan, role = role, isActive = isActive),
        ).toDomain()
    }

    override suspend fun pipeline(limit: Int): AdminPipeline = withContext(io) {
        api.adminPipeline(limit = limit).toDomain()
    }

    override suspend fun triggerPipeline(job: String): AdminPipelineTrigger = withContext(io) {
        api.triggerAdminPipeline(AdminPipelineTriggerRequestDto(job = job)).toDomain()
    }

    override suspend fun analytics(): AdminAnalytics = withContext(io) {
        api.adminAnalytics().toDomain()
    }

    override suspend fun feedback(limit: Int, status: String?): List<AdminFeedbackItem> =
        withContext(io) {
            api.adminFeedback(limit = limit, status = status).feedback.map { it.toDomain() }
        }

    override suspend fun updateFeedback(id: Int, status: String): AdminFeedbackItem =
        withContext(io) {
            api.updateAdminFeedback(id, AdminFeedbackUpdateDto(status = status)).toDomain()
        }

    override suspend fun dealers(limit: Int, status: String?): List<AdminDealerRow> =
        withContext(io) {
            api.adminDealers(limit = limit, status = status).dealers.map { it.toDomain() }
        }

    override suspend fun verifyDealer(id: Int): AdminDealerRow = withContext(io) {
        api.verifyAdminDealer(id).toDomain()
    }

    override suspend fun adminPermits(): List<AdminPermitRow> = withContext(io) {
        api.adminPermits().permits.map { it.toDomain() }
    }

    override suspend fun upsertPermit(name: String, type: String, price: Double): AdminPermitRow =
        withContext(io) {
            api.upsertAdminPermit(
                AdminPermitUpsertDto(
                    permitName = name.trim(),
                    permitType = type.trim(),
                    marketPriceLkr = price,
                ),
            ).toDomain()
        }

    override suspend fun system(): AdminSystem = withContext(io) {
        api.adminSystem().toDomain()
    }

    override suspend fun clearCache(key: String?): AdminCacheClear = withContext(io) {
        api.clearAdminCache(key = key).toDomain()
    }

    override suspend fun runRevcarPilot(): AdminRevcarPilot = withContext(io) {
        api.runRevcarDataPilot().toDomain()
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

private fun AdminNamedCountDto.toDomain() = AdminNamedCount(
    label = source ?: district ?: plan ?: status ?: "—",
    count = count,
)

private fun AdminPipelineRunDto.toDomain() = AdminPipelineRun(
    id = id,
    source = source,
    status = status,
    listingsFound = listingsFound,
    listingsNew = listingsNew,
    startedAt = startedAt,
    finishedAt = finishedAt,
    errorMessage = errorMessage,
)

private fun AdminPipelineResponseDto.toDomain() = AdminPipeline(
    orphansReconciled = orphansReconciled,
    runs = runs.map { it.toDomain() },
)

private fun AdminPipelineTriggerDto.toDomain() = AdminPipelineTrigger(
    ok = ok,
    triggeredBy = triggeredBy,
    job = job,
    pid = pid,
    command = command,
    startedAt = startedAt,
)

private fun AdminAnalyticsDto.toDomain() = AdminAnalytics(
    listings = AdminAnalyticsListings(
        bySource = listings.bySource.map { it.toDomain() },
        byDistrict = listings.byDistrict.map { it.toDomain() },
        avgPriceLkr = listings.avgPriceLkr,
        minPriceLkr = listings.minPriceLkr,
        maxPriceLkr = listings.maxPriceLkr,
    ),
    users = AdminAnalyticsUsers(
        byPlan = users.byPlan.map { it.toDomain() },
        bySubscription = users.bySubscription.map { it.toDomain() },
        signupsToday = users.signupsToday,
        inactive = users.inactive,
        neverLoggedIn = users.neverLoggedIn,
    ),
    alerts = AdminAnalyticsAlerts(
        active = alerts.active,
        withWhatsapp = alerts.withWhatsapp,
    ),
    signals = AdminAnalyticsSignals(
        total = signals.total,
        bySource = signals.bySource.map { it.toDomain() },
    ),
    scrapes = AdminAnalyticsScrapes(
        success = scrapes.success,
        failed = scrapes.failed,
    ),
    invites = invites.map { it.toDomain() },
    feedback = feedback.map { it.toDomain() },
    dealers = dealers.map { it.toDomain() },
    generatedAt = generatedAt,
)

private fun AdminFeedbackDto.toDomain() = AdminFeedbackItem(
    id = id,
    category = category,
    route = route,
    message = message,
    email = email,
    status = status,
    createdAt = createdAt,
)

private fun AdminDealerDto.toDomain() = AdminDealerRow(
    id = id,
    displayName = displayName,
    contactPhone = contactPhone,
    contactEmail = contactEmail,
    sellerNamePattern = sellerNamePattern,
    claimedUrl = claimedUrl,
    status = status,
    plan = plan,
    subscriptionStatus = subscriptionStatus,
    verifiedAt = verifiedAt,
    createdAt = createdAt,
)

private fun AdminPermitDto.toDomain() = AdminPermitRow(
    id = id,
    permitName = permitName,
    permitType = permitType,
    marketPriceLkr = marketPriceLkr,
    updatedAt = updatedAt,
)

private fun AdminFlagDto.toDomain() = AdminFlagSet(
    appAccessEnforced = appAccessEnforced,
    proAccessEnforced = proAccessEnforced,
    adminApiKeyConfigured = adminApiKeyConfigured,
    billingWebhookConfigured = billingWebhookConfigured,
    b2bKeysConfigured = b2bKeysConfigured,
    resendConfigured = resendConfigured,
    twilioConfigured = twilioConfigured,
    telegramConfigured = telegramConfigured,
    emailAlertConfigured = emailAlertConfigured,
    publicAppOrigin = publicAppOrigin,
)

private fun AdminProviderDto.toDomain() = AdminProvider(
    id = id,
    label = label.ifBlank { id },
    enabled = enabled,
    configured = configured,
    lastRun = lastRun,
)

private fun AdminSystemDto.toDomain() = AdminSystem(
    databaseOk = databaseOk,
    flags = flags.toDomain(),
    statsCacheKeys = statsCacheKeys,
    providers = providers.map { it.toDomain() },
)

private fun AdminCacheClearDto.toDomain() = AdminCacheClear(
    ok = ok,
    deleted = deleted,
    clearedBy = clearedBy,
)

private fun AdminRevcarPilotDto.toDomain() = AdminRevcarPilot(
    ok = ok,
    triggeredBy = triggeredBy,
    status = status,
    attempted = attempted,
    matched = matched,
    falseMatches = falseMatches,
    matchRate = matchRate,
)
