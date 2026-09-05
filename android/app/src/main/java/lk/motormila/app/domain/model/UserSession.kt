package lk.motormila.app.domain.model

/**
 * Authenticated session. Mirrors backend auth payload (endpoints/auth.py):
 * JWT in mm_session cookie / Authorization header carrying plan + role.
 */
data class UserSession(
    val email: String,
    val name: String?,
    /** "free" | "pro" | ... (backend PRO_PLANS). */
    val plan: String,
    /** "user" | "admin". */
    val role: String,
    val subscriptionStatus: String?,
    val token: String,
    /** ISO-8601 expiry, null = non-expiring / unknown. */
    val expiresAt: String?,
) {
    val isPro: Boolean
        get() = plan.equals("pro", ignoreCase = true) ||
            plan.equals("pro_plus", ignoreCase = true) ||
            plan.equals("business", ignoreCase = true)

    val isAdmin: Boolean get() = role.equals("admin", ignoreCase = true)
}
