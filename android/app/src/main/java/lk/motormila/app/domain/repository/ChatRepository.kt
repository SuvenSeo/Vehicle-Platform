package lk.motormila.app.domain.repository

import lk.motormila.app.domain.model.ChatMessage

interface ChatRepository {
    suspend fun ask(message: String, history: List<ChatMessage> = emptyList()): ChatMessage
}
