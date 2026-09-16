package lk.motormila.app.data.remote.mapper

import lk.motormila.app.data.remote.dto.AlertDto
import lk.motormila.app.domain.model.AlertInput
import org.junit.Assert.assertEquals
import org.junit.Test

class AlertMappersTest {

    @Test
    fun alertDto_mapsDeliveryAndQuietHours() {
        val domain = AlertDto(
            id = 9,
            make = "Toyota",
            maxPrice = 8_000_000.0,
            notifyChannels = "inapp,whatsapp,push",
            deliveryMode = "digest",
            quietHoursEnabled = false,
        ).toDomain()
        assertEquals("digest", domain.deliveryMode)
        assertEquals(false, domain.quietHoursEnabled)
        assertEquals("inapp,whatsapp,push", domain.notifyChannels)
    }

    @Test
    fun alertDto_nullDeliveryDefaultsToInstantQuietOn() {
        val domain = AlertDto(id = 1, make = "Honda").toDomain()
        assertEquals("instant", domain.deliveryMode)
        assertEquals(true, domain.quietHoursEnabled)
    }

    @Test
    fun alertInput_toRequestSendsChannelsDeliveryAndQuietHours() {
        val request = AlertInput(
            make = "Suzuki",
            maxPriceLkr = 4_000_000.0,
            notifyPhone = "0771234567",
            notifyTelegramChatId = "42",
            notifyChannels = "inapp,email,whatsapp,telegram,push",
            deliveryMode = "digest",
            quietHoursEnabled = true,
        ).toRequest()
        assertEquals("0771234567", request.notifyPhone)
        assertEquals("42", request.notifyTelegramChatId)
        assertEquals("inapp,email,whatsapp,telegram,push", request.notifyChannels)
        assertEquals("digest", request.deliveryMode)
        assertEquals(true, request.quietHoursEnabled)
    }
}
