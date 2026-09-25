package lk.motormila.app.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class AdminOverviewDto(
    val listings: AdminCountPairDto = AdminCountPairDto(),
    val users: AdminUsersCountDto = AdminUsersCountDto(),
    val invites: AdminInvitesCountDto = AdminInvitesCountDto(),
    val feedback: AdminFeedbackCountDto = AdminFeedbackCountDto(),
    val dealers: AdminDealersCountDto = AdminDealersCountDto(),
    val recentScrapes: List<AdminScrapeRunDto> = emptyList(),
    val topMakes: List<AdminMakeCountDto> = emptyList(),
    val generatedAt: String? = null,
)

@Serializable
data class AdminCountPairDto(
    val total: Int = 0,
    val live: Int = 0,
)

@Serializable
data class AdminUsersCountDto(
    val total: Int = 0,
    val free: Int = 0,
    val pro: Int = 0,
    val admins: Int = 0,
)

@Serializable
data class AdminInvitesCountDto(val pending: Int = 0)

@Serializable
data class AdminFeedbackCountDto(val open: Int = 0)

@Serializable
data class AdminDealersCountDto(val verified: Int = 0)

@Serializable
data class AdminScrapeRunDto(
    val id: Int = 0,
    val source: String = "",
    val status: String = "",
    val listingsFound: Int = 0,
    val listingsNew: Int = 0,
    val startedAt: String? = null,
)

@Serializable
data class AdminMakeCountDto(
    val make: String? = null,
    val count: Int = 0,
)

@Serializable
data class AdminUsersResponseDto(
    val total: Int = 0,
    val users: List<AdminUserDto> = emptyList(),
)

@Serializable
data class AdminUserDto(
    val id: Int = 0,
    val email: String = "",
    val name: String = "",
    val plan: String = "free",
    val subscriptionStatus: String = "none",
    val role: String = "user",
    val isActive: Boolean = true,
    val createdAt: String? = null,
)

@Serializable
data class AdminUserUpdateDto(
    val plan: String? = null,
    val role: String? = null,
    @kotlinx.serialization.SerialName("is_active") val isActive: Boolean? = null,
)

@Serializable
data class AdminInvitesResponseDto(
    val invites: List<AdminInviteDto> = emptyList(),
)

@Serializable
data class AdminInviteDto(
    val id: Int = 0,
    val email: String = "",
    val plan: String = "free",
    val role: String = "user",
    val status: String = "pending",
    val token: String = "",
    val signupPath: String? = null,
    val expiresAt: String? = null,
    val emailSent: Boolean? = null,
)

@Serializable
data class AdminInviteCreateDto(
    val email: String,
    val plan: String = "free",
    val role: String = "user",
)

@Serializable
data class SelfSignupStatusDto(
    val enabled: Boolean = false,
    val trialDays: Int = 7,
    val plan: String = "pro",
)

@Serializable
data class SelfSignupRequestDto(
    val email: String,
    val name: String,
    val password: String,
)

@Serializable
data class AdminNamedCountDto(
    val source: String? = null,
    val district: String? = null,
    val plan: String? = null,
    val status: String? = null,
    val count: Int = 0,
)

@Serializable
data class AdminAnalyticsListingsDto(
    val bySource: List<AdminNamedCountDto> = emptyList(),
    val byDistrict: List<AdminNamedCountDto> = emptyList(),
    val avgPriceLkr: Double = 0.0,
    val minPriceLkr: Double = 0.0,
    val maxPriceLkr: Double = 0.0,
)

@Serializable
data class AdminAnalyticsUsersDto(
    val byPlan: List<AdminNamedCountDto> = emptyList(),
    val bySubscription: List<AdminNamedCountDto> = emptyList(),
    val signupsToday: Int = 0,
    val inactive: Int = 0,
    val neverLoggedIn: Int = 0,
)

@Serializable
data class AdminAnalyticsAlertsDto(
    val active: Int = 0,
    val withWhatsapp: Int = 0,
)

@Serializable
data class AdminAnalyticsSignalsDto(
    val total: Int = 0,
    val bySource: List<AdminNamedCountDto> = emptyList(),
)

@Serializable
data class AdminAnalyticsScrapesDto(
    val success: Int = 0,
    val failed: Int = 0,
)

@Serializable
data class AdminAnalyticsDto(
    val listings: AdminAnalyticsListingsDto = AdminAnalyticsListingsDto(),
    val users: AdminAnalyticsUsersDto = AdminAnalyticsUsersDto(),
    val alerts: AdminAnalyticsAlertsDto = AdminAnalyticsAlertsDto(),
    val signals: AdminAnalyticsSignalsDto = AdminAnalyticsSignalsDto(),
    val scrapes: AdminAnalyticsScrapesDto = AdminAnalyticsScrapesDto(),
    val invites: List<AdminNamedCountDto> = emptyList(),
    val feedback: List<AdminNamedCountDto> = emptyList(),
    val dealers: List<AdminNamedCountDto> = emptyList(),
    val generatedAt: String? = null,
)

@Serializable
data class AdminPipelineRunDto(
    val id: Int = 0,
    val source: String = "",
    val status: String = "",
    val listingsFound: Int = 0,
    val listingsNew: Int = 0,
    val startedAt: String? = null,
    val finishedAt: String? = null,
    val errorMessage: String? = null,
)

@Serializable
data class AdminPipelineResponseDto(
    val orphansReconciled: Int = 0,
    val runs: List<AdminPipelineRunDto> = emptyList(),
)

@Serializable
data class AdminPipelineTriggerRequestDto(
    val job: String = "sync",
)

@Serializable
data class AdminPipelineTriggerDto(
    val ok: Boolean = false,
    val triggeredBy: String? = null,
    val job: String? = null,
    val pid: Int? = null,
    val command: String? = null,
    @kotlinx.serialization.SerialName("started_at") val startedAt: String? = null,
)

@Serializable
data class AdminFeedbackDto(
    val id: Int = 0,
    val category: String = "",
    val route: String? = null,
    val message: String = "",
    val email: String? = null,
    val status: String = "new",
    val createdAt: String? = null,
)

@Serializable
data class AdminFeedbackResponseDto(
    val feedback: List<AdminFeedbackDto> = emptyList(),
)

@Serializable
data class AdminFeedbackUpdateDto(
    val status: String,
)

@Serializable
data class AdminDealerDto(
    val id: Int = 0,
    val displayName: String = "",
    val contactPhone: String? = null,
    val contactEmail: String? = null,
    val sellerNamePattern: String? = null,
    val claimedUrl: String? = null,
    val status: String = "pending",
    val plan: String? = null,
    val subscriptionStatus: String? = null,
    val verifiedAt: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class AdminDealersResponseDto(
    val dealers: List<AdminDealerDto> = emptyList(),
)

@Serializable
data class AdminPermitDto(
    val id: Int = 0,
    val permitName: String = "",
    val permitType: String = "",
    val marketPriceLkr: Double = 0.0,
    val updatedAt: String? = null,
)

@Serializable
data class AdminPermitsResponseDto(
    val permits: List<AdminPermitDto> = emptyList(),
)

@Serializable
data class AdminPermitUpsertDto(
    @kotlinx.serialization.SerialName("permit_name") val permitName: String,
    @kotlinx.serialization.SerialName("permit_type") val permitType: String,
    @kotlinx.serialization.SerialName("market_price_lkr") val marketPriceLkr: Double,
)

@Serializable
data class AdminFlagDto(
    val appAccessEnforced: Boolean = false,
    val proAccessEnforced: Boolean = false,
    val adminApiKeyConfigured: Boolean = false,
    val billingWebhookConfigured: Boolean = false,
    val b2bKeysConfigured: Boolean = false,
    val resendConfigured: Boolean = false,
    val twilioConfigured: Boolean = false,
    val telegramConfigured: Boolean = false,
    val emailAlertConfigured: Boolean = false,
    val publicAppOrigin: String? = null,
)

@Serializable
data class AdminProviderDto(
    val id: String = "",
    val label: String = "",
    val enabled: Boolean = false,
    val configured: Boolean = false,
    val lastRun: String? = null,
)

@Serializable
data class AdminSystemDto(
    val databaseOk: Boolean = false,
    val flags: AdminFlagDto = AdminFlagDto(),
    val statsCacheKeys: List<String> = emptyList(),
    val providers: List<AdminProviderDto> = emptyList(),
)

@Serializable
data class AdminCacheClearDto(
    val ok: Boolean = false,
    val deleted: Int = 0,
    val clearedBy: String? = null,
)

@Serializable
data class AdminRevcarPilotDto(
    val ok: Boolean = false,
    val triggeredBy: String? = null,
    val status: String? = null,
    val attempted: Int = 0,
    val matched: Int = 0,
    @kotlinx.serialization.SerialName("false_matches") val falseMatches: Int = 0,
    @kotlinx.serialization.SerialName("match_rate") val matchRate: Double? = null,
)
