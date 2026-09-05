package lk.motormila.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Backend: endpoints/chat.py — POST /chat returns a dict; keys vary by mode. */
@Serializable
data class ChatMessageDto(
    val role: String,
    val content: String,
)

@Serializable
data class ChatRequestDto(
    val message: String,
    val history: List<ChatMessageDto> = emptyList(),
    val model: String? = null,
    @SerialName("page_context") val pageContext: Map<String, String> = emptyMap(),
)

@Serializable
data class ChatResponseDto(
    val reply: String? = null,
    val message: String? = null,
    val response: String? = null,
    val answer: String? = null,
    val listings: List<ListingDto> = emptyList(),
    val model: String? = null,
) {
    fun text(): String =
        reply ?: message ?: response ?: answer ?: "Sorry, I could not generate a reply."
}
