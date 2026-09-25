package lk.motormila.app.core.network

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/**
 * Backend datetimes are ISO-8601 strings (sometimes epoch seconds for
 * `expires_at`). DTOs keep them as `String?` (domain also uses ISO strings),
 * so no java.time parsing is needed in data/. This adapter covers the few
 * numeric epoch fields by coercing them to string at decode time.
 */
object IsoStringOrEpochSerializer : KSerializer<String?> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("IsoStringOrEpoch", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String? = runCatching {
        decoder.decodeString()
    }.getOrElse {
        runCatching {
            val epoch = decoder.decodeLong()
            java.time.Instant.ofEpochSecond(epoch).toString()
        }.getOrNull()
    }

    override fun serialize(encoder: Encoder, value: String?) {
        if (value == null) encoder.encodeNull() else encoder.encodeString(value)
    }
}
