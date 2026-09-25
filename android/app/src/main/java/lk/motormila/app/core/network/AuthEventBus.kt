package lk.motormila.app.core.network

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * App-wide auth event bus. [AuthInterceptor] emits [Unauthorized] on HTTP 401;
 * UI layer collects this flow (e.g. in MainActivity) to force logout / nav to login.
 * Kept in core.network so data/ has zero UI imports.
 */
@Singleton
class AuthEventBus @Inject constructor() {
    private val _events = MutableSharedFlow<AuthEvent>(extraBufferCapacity = 1)
    val events: SharedFlow<AuthEvent> = _events.asSharedFlow()

    fun post(event: AuthEvent) {
        _events.tryEmit(event)
    }
}

sealed interface AuthEvent {
    /** Access token rejected (401). Payload arg = request path that failed. */
    data class Unauthorized(val path: String? = null) : AuthEvent
}
