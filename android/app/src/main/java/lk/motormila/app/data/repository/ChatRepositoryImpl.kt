package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.ChatMessageDto
import lk.motormila.app.data.remote.dto.ChatRequestDto
import lk.motormila.app.data.remote.mapper.toDomain
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.model.ChatMessage
import lk.motormila.app.domain.repository.ChatRepository

@Singleton
class ChatRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    @IoDispatcher private val io: CoroutineDispatcher,
) : ChatRepository {

    override suspend fun ask(message: String, history: List<ChatMessage>): ChatMessage = withContext(io) {
        val res = api.chat(
            ChatRequestDto(
                message = message,
                history = history.takeLast(12).map { ChatMessageDto(it.role, it.content) },
            ),
        )
        ChatMessage(
            role = "assistant",
            content = res.text(),
            listings = res.listings.map { it.toDomain() },
        )
    }
}
