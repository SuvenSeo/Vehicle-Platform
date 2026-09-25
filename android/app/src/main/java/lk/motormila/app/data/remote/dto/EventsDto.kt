package lk.motormila.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Backend: endpoints/events.py — POST /events. */
@Serializable
data class AnalyticsEventRequestDto(
    val event: String,
    val properties: Map<String, JsonElement> = emptyMap(),
    @SerialName("session_id") val sessionId: String? = null,
)

@Serializable
data class AnalyticsEventResponseDto(
    val id: Int = 0,
    val event: String = "",
    @SerialName("created_at") val createdAt: String? = null,
)
