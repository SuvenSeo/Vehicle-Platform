package lk.motormila.app.core.network

import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton
import lk.motormila.app.data.local.datastore.SessionStore
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Adds `Authorization: Bearer <token>` to every request when a token exists.
 *
 * Token sourcing (fast path first):
 * 1. In-memory `@Volatile` [cachedToken] — updated synchronously by
 *    [lk.motormila.app.data.repository.AuthRepositoryImpl] on login/logout/restore,
 *    so no DataStore read happens on the network thread.
 * 2. [SessionStore.cachedToken] snapshot (same in-memory value, survives process death
 *    via DataStore re-hydration at startup).
 *
 * [Provider] indirection breaks the Hilt cycle:
 * OkHttp -> Interceptor -> SessionStore -/-> ApiService -> OkHttp.
 *
 * On HTTP 401 the [AuthEventBus] is notified (UI forces re-login). The 401
 * response itself still propagates so repositories map it to [AppError.Unauthorized].
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val sessionStore: Provider<SessionStore>,
    private val authEventBus: AuthEventBus,
) : Interceptor {

    @Volatile
    var cachedToken: String? = null
        private set

    /** Called by AuthRepositoryImpl immediately after login/logout/restore. */
    fun updateToken(token: String?) {
        cachedToken = token
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = cachedToken ?: runCatching { sessionStore.get().cachedToken }.getOrNull()
        if (cachedToken == null && token != null) cachedToken = token

        val request = if (!token.isNullOrBlank()) {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        val response = chain.proceed(request)
        if (response.code == 401) {
            authEventBus.post(AuthEvent.Unauthorized(request.url.encodedPath))
        }
        return response
    }
}
