package lk.motormila.app.core.network

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Guest browse must not treat anonymous 401s as a session expiry. */
class AuthInterceptorPolicyTest {

    @Test
    fun rejectedBearerForcesRelogin() {
        assertTrue(shouldForceReLogin(hadBearerToken = true, statusCode = 401))
    }

    @Test
    fun anonymousUnauthorizedDoesNotKickToLogin() {
        assertFalse(shouldForceReLogin(hadBearerToken = false, statusCode = 401))
    }

    @Test
    fun otherStatusCodesNeverForceRelogin() {
        assertFalse(shouldForceReLogin(hadBearerToken = true, statusCode = 403))
        assertFalse(shouldForceReLogin(hadBearerToken = true, statusCode = 200))
        assertFalse(shouldForceReLogin(hadBearerToken = false, statusCode = 200))
    }
}
