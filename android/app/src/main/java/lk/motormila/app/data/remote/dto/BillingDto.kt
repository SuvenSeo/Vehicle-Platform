package lk.motormila.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Backend: endpoints/billing.py — POST /billing/checkout-intent. */
@Serializable
data class CheckoutIntentRequestDto(val plan: String)

@Serializable
data class CheckoutIntentResponseDto(
    val provider: String = "manual",
    @SerialName("checkout_url") val checkoutUrl: String? = null,
    val message: String = "",
)
