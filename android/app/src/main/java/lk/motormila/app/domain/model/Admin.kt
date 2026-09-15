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
