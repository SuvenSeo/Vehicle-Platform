package lk.motormila.app.domain.usecase

import kotlinx.coroutines.flow.Flow
import lk.motormila.app.domain.model.UserSession
import lk.motormila.app.domain.repository.AuthRepository
import javax.inject.Inject

class ObserveSessionUseCase @Inject constructor(
    private val auth: AuthRepository,
) {
    operator fun invoke(): Flow<UserSession?> = auth.session()
}
