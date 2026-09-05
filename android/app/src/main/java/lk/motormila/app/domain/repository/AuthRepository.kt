package lk.motormila.app.domain.repository

import kotlinx.coroutines.flow.Flow
import lk.motormila.app.domain.model.UserSession

interface AuthRepository {
    /** Null when signed out. */
    fun session(): Flow<UserSession?>

    suspend fun me(): UserSession?

    suspend fun login(email: String, password: String): UserSession

    suspend fun signup(name: String, email: String, password: String, inviteToken: String?): UserSession

    suspend fun logout()

    /** Restore persisted session on cold start (data builder reads DataStore). */
    suspend fun restore(): UserSession?
}
