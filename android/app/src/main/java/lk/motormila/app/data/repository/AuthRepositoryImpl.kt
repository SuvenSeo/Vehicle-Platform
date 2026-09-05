package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import lk.motormila.app.core.network.AuthInterceptor
import lk.motormila.app.data.local.datastore.SessionStore
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.LoginRequest
import lk.motormila.app.data.remote.dto.SignupRequest
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.UserSession
import lk.motormila.app.domain.repository.AuthRepository

/**
 * Auth: login/signup/me/logout against the POST and GET auth endpoints, session persisted in
 * SessionStore. Every mutation synchronously refreshes
 * [AuthInterceptor.updateToken] so subsequent requests carry the new token
 * without waiting for a DataStore read.
 */
@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    private val sessionStore: SessionStore,
    private val authInterceptor: AuthInterceptor,
    @IoDispatcher private val io: CoroutineDispatcher,
) : AuthRepository {

    override fun session(): Flow<UserSession?> = sessionStore.observe()

    override suspend fun me(): UserSession? = withContext(io) {
        val dto = api.me().user
        val token = sessionStore.cachedToken ?: return@withContext null
        val session = UserSession(
            email = dto.email,
            name = dto.name.ifBlank { null },
            plan = dto.plan.ifBlank { "free" },
            role = dto.role.ifBlank { "user" },
            subscriptionStatus = dto.subscriptionStatus,
            token = token,
            expiresAt = sessionStore.snapshot()?.expiresAt,
        )
        sessionStore.saveSession(session)
        session
    }

    override suspend fun login(email: String, password: String): UserSession = withContext(io) {
        val res = api.login(LoginRequest(email.trim(), password))
        val session = UserSession(
            email = res.user.email,
            name = res.user.name.ifBlank { null },
            plan = res.user.plan.ifBlank { "free" },
            role = res.user.role.ifBlank { "user" },
            subscriptionStatus = res.user.subscriptionStatus,
            token = res.token,
            expiresAt = SessionStore.epochToIso(res.expiresAt),
        )
        sessionStore.saveSession(session)
        authInterceptor.updateToken(session.token)
        session
    }

    override suspend fun signup(name: String, email: String, password: String, inviteToken: String?): UserSession =
        withContext(io) {
            // Backend signup is invite-token based; email is bound server-side to the invite.
            val res = api.signup(SignupRequest(token = inviteToken.orEmpty(), name = name, password = password))
            val session = UserSession(
                email = res.user.email.ifBlank { email },
                name = res.user.name.ifBlank { name },
                plan = res.user.plan.ifBlank { "free" },
                role = res.user.role.ifBlank { "user" },
                subscriptionStatus = res.user.subscriptionStatus,
                token = res.token,
                expiresAt = SessionStore.epochToIso(res.expiresAt),
            )
            sessionStore.saveSession(session)
            authInterceptor.updateToken(session.token)
            session
        }

    override suspend fun logout() = withContext(io) {
        runCatching { api.logout() }
        sessionStore.clear()
        authInterceptor.updateToken(null)
    }

    override suspend fun restore(): UserSession? = withContext(io) {
        val session = sessionStore.rehydrate()
        authInterceptor.updateToken(session?.token)
        session
    }
}
