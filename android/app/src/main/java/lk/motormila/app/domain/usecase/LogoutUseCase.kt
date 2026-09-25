package lk.motormila.app.domain.usecase

import lk.motormila.app.domain.repository.AuthRepository
import javax.inject.Inject

class LogoutUseCase @Inject constructor(
    private val auth: AuthRepository,
) {
    suspend operator fun invoke() = auth.logout()
}
