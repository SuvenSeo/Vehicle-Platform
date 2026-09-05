package lk.motormila.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Market / EV / vehicle-safety DTOs.
 * Backend: endpoints/market.py, ev.py, vehicles.py.
 */
@Serializable
data class MarketSignalDto(
    val id: Int = 0,
    val source: String = "",
    @SerialName("signal_type") val signalType: String = "",
    @SerialName("period_year") val periodYear: Int? = null,
    @SerialName("period_month") val periodMonth: Int? = null,
    val metric: String = "",
    val category: String? = null,
    @SerialName("value_numeric") val valueNumeric: Double? = null,
    val unit: String? = null,
    @SerialName("source_url") val sourceUrl: String = "",
    @SerialName("observed_at") val observedAt: String = "",
    @SerialName("raw_meta") val rawMeta: Map<String, JsonElement> = emptyMap(),
)

@Serializable
data class ImportPriceDto(
    val id: Int = 0,
    val source: String = "",
    @SerialName("source_id") val sourceId: String = "",
    @SerialName("observed_at") val observedAt: String = "",
    val url: String = "",
    val title: String? = null,
    val make: String? = null,
    val model: String? = null,
    val year: Int? = null,
    @SerialName("price_lkr") val priceLkr: Double? = null,
    val mileage: Int? = null,
    @SerialName("fuel_type") val fuelType: String? = null,
    val transmission: String? = null,
    @SerialName("body_type") val bodyType: String? = null,
    @SerialName("source_market") val sourceMarket: String? = null,
)

@Serializable
data class MarketSignalSummaryRowDto(
    val source: String = "",
    @SerialName("signal_type") val signalType: String = "",
    val count: Int = 0,
    @SerialName("latest_observed_at") val latestObservedAt: String? = null,
)

@Serializable
data class MarketSummaryDto(
    val signals: List<MarketSignalSummaryRowDto> = emptyList(),
)

@Serializable
data class ChargingStationDto(
    val id: String? = null,
    val title: String? = null,
    val name: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("town") val town: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("distance_km") val distanceKm: Double? = null,
    @SerialName("connection_types") val connectionTypes: List<String> = emptyList(),
    @SerialName("status") val status: String? = null,
)

@Serializable
data class ChargingStationsDto(
    val count: Int = 0,
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    @SerialName("radius_km") val radiusKm: Double = 25.0,
    val attribution: String? = null,
    val limitation: String? = null,
    val stations: List<ChargingStationDto> = emptyList(),
)

@Serializable
data class VehicleSafetyDto(
    val make: String? = null,
    val model: String? = null,
    val year: Int? = null,
    val summary: String? = null,
    val rating: String? = null,
    val recalls: List<SafetyRecallDto> = emptyList(),
    val complaints: List<SafetyComplaintDto> = emptyList(),
    val sources: List<String> = emptyList(),
)
