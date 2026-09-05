package lk.motormila.app.data.remote.dto

import kotlinx.serialization.Serializable

/** Backend: endpoints/feedback.py — POST /feedback. */
@Serializable
data class FeedbackRequestDto(
    val category: String = "general",
    val route: String? = null,
    val message: String,
    val email: String? = null,
)

@Serializable
data class FeedbackResponseDto(
    val id: Int = 0,
    val category: String = "general",
    val route: String? = null,
    val status: String = "open",
    val created_at: String? = null,
)
