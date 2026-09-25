package lk.motormila.app.domain.usecase

import lk.motormila.app.domain.model.UserSession
import lk.motormila.app.domain.repository.AuthRepository
import javax.inject.Inject

class LoginUseCase @Inject constructor(
    private val auth: AuthRepository,
) {
    suspend operator fun invoke(email: String, password: String): UserSession =
        auth.login(email.trim(), password)
}
