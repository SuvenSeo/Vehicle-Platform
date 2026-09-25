package lk.motormila.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Auth DTOs. Backend: backend/app/api/v1/endpoints/auth.py
 * - POST /auth/login {email,password} -> {user, token, expires_at(epoch s)}
 * - POST /auth/signup {token,name,password} -> same shape
 * - GET /auth/me -> {user}
 * - GET /auth/invite/{token} -> {email, plan, role, ...} preview
 * - POST /auth/logout -> {ok}
 */
@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class SignupRequest(
    val token: String,
    val name: String,
    val password: String,
)

@Serializable
data class UserDto(
    val email: String = "",
    val name: String = "",
    val plan: String = "free",
    @SerialName("subscriptionStatus") val subscriptionStatus: String? = null,
    val role: String = "user",
    @SerialName("avatarInitials") val avatarInitials: String? = null,
)

@Serializable
data class TokenResponse(
    val user: UserDto = UserDto(),
    val token: String = "",
    @SerialName("expires_at") val expiresAt: Long? = null,
)

@Serializable
data class MeResponse(
    val user: UserDto = UserDto(),
)

@Serializable
data class InvitePreviewDto(
    val email: String? = null,
    val plan: String? = null,
    val role: String? = null,
    val status: String? = null,
)

@Serializable
data class OkResponse(
    val ok: Boolean = true,
)
