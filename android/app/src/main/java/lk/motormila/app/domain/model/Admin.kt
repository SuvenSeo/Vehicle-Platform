package lk.motormila.app.domain.model

data class AdminOverview(
    val listingsTotal: Int = 0,
    val listingsLive: Int = 0,
    val usersTotal: Int = 0,
    val usersFree: Int = 0,
    val usersPro: Int = 0,
    val usersAdmin: Int = 0,
    val invitesPending: Int = 0,
    val feedbackOpen: Int = 0,
    val dealersVerified: Int = 0,
    val generatedAt: String? = null,
    val topMakes: List<AdminMakeCount> = emptyList(),
    val recentScrapes: List<AdminScrapeRun> = emptyList(),
)

data class AdminMakeCount(
    val make: String,
    val count: Int,
)

data class AdminScrapeRun(
    val id: Int,
    val source: String,
    val status: String,
    val listingsFound: Int,
    val listingsNew: Int,
    val startedAt: String?,
)

data class AdminUserRow(
    val id: Int,
    val email: String,
    val name: String,
    val plan: String,
    val subscriptionStatus: String,
    val role: String,
    val isActive: Boolean,
    val createdAt: String?,
)

data class AdminInviteRow(
    val id: Int,
    val email: String,
    val plan: String,
    val role: String,
    val status: String,
    val token: String,
    val signupPath: String?,
    val expiresAt: String?,
    val emailSent: Boolean? = null,
)

data class SelfSignupStatus(
    val enabled: Boolean,
    val trialDays: Int,
    val plan: String,
)

data class AdminNamedCount(
    val label: String,
    val count: Int,
)

data class AdminPipeline(
    val orphansReconciled: Int = 0,
    val runs: List<AdminPipelineRun> = emptyList(),
)

data class AdminPipelineRun(
    val id: Int,
    val source: String,
    val status: String,
    val listingsFound: Int,
    val listingsNew: Int,
    val startedAt: String?,
    val finishedAt: String?,
    val errorMessage: String?,
)

data class AdminPipelineTrigger(
    val ok: Boolean = false,
    val triggeredBy: String? = null,
    val job: String? = null,
    val pid: Int? = null,
    val command: String? = null,
    val startedAt: String? = null,
)

data class AdminAnalyticsListings(
    val bySource: List<AdminNamedCount> = emptyList(),
    val byDistrict: List<AdminNamedCount> = emptyList(),
    val avgPriceLkr: Double = 0.0,
    val minPriceLkr: Double = 0.0,
    val maxPriceLkr: Double = 0.0,
)

data class AdminAnalyticsUsers(
    val byPlan: List<AdminNamedCount> = emptyList(),
    val bySubscription: List<AdminNamedCount> = emptyList(),
    val signupsToday: Int = 0,
    val inactive: Int = 0,
    val neverLoggedIn: Int = 0,
)

data class AdminAnalyticsAlerts(
    val active: Int = 0,
    val withWhatsapp: Int = 0,
)

data class AdminAnalyticsSignals(
    val total: Int = 0,
    val bySource: List<AdminNamedCount> = emptyList(),
)

data class AdminAnalyticsScrapes(
    val success: Int = 0,
    val failed: Int = 0,
)

data class AdminAnalytics(
    val listings: AdminAnalyticsListings = AdminAnalyticsListings(),
    val users: AdminAnalyticsUsers = AdminAnalyticsUsers(),
    val alerts: AdminAnalyticsAlerts = AdminAnalyticsAlerts(),
    val signals: AdminAnalyticsSignals = AdminAnalyticsSignals(),
    val scrapes: AdminAnalyticsScrapes = AdminAnalyticsScrapes(),
    val invites: List<AdminNamedCount> = emptyList(),
    val feedback: List<AdminNamedCount> = emptyList(),
    val dealers: List<AdminNamedCount> = emptyList(),
    val generatedAt: String? = null,
)

data class AdminFeedbackItem(
    val id: Int,
    val category: String,
    val route: String?,
    val message: String,
    val email: String?,
    val status: String,
    val createdAt: String?,
)

data class AdminDealerRow(
    val id: Int,
    val displayName: String,
    val contactPhone: String?,
    val contactEmail: String?,
    val sellerNamePattern: String?,
    val claimedUrl: String?,
    val status: String,
    val plan: String?,
    val subscriptionStatus: String?,
    val verifiedAt: String?,
    val createdAt: String?,
) {
    val isVerified: Boolean get() = status.equals("verified", ignoreCase = true)
}

data class AdminPermitRow(
    val id: Int,
    val permitName: String,
    val permitType: String,
    val marketPriceLkr: Double,
    val updatedAt: String?,
)

data class AdminFlagSet(
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

data class AdminProvider(
    val id: String,
    val label: String,
    val enabled: Boolean,
    val configured: Boolean,
    val lastRun: String?,
)

data class AdminSystem(
    val databaseOk: Boolean = false,
    val flags: AdminFlagSet = AdminFlagSet(),
    val statsCacheKeys: List<String> = emptyList(),
    val providers: List<AdminProvider> = emptyList(),
)

data class AdminCacheClear(
    val ok: Boolean = false,
    val deleted: Int = 0,
    val clearedBy: String? = null,
)

data class AdminRevcarPilot(
    val ok: Boolean = false,
    val triggeredBy: String? = null,
    val status: String? = null,
    val attempted: Int = 0,
    val matched: Int = 0,
    val falseMatches: Int = 0,
    val matchRate: Double? = null,
)
