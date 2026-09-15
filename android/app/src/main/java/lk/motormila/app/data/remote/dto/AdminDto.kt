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
    val isActive: Boolean? = null,
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
