package lk.motormila.app.data.remote.mapper

import lk.motormila.app.data.remote.dto.ArbitrageGapDto
import lk.motormila.app.data.remote.dto.DistrictProfileDto
import lk.motormila.app.data.remote.dto.LaneDetailDto
import lk.motormila.app.data.remote.dto.ProSnapshotDto
import lk.motormila.app.data.remote.dto.VehicleLaneDto
import lk.motormila.app.domain.model.ArbitrageGap
import lk.motormila.app.domain.model.ProDistrict
import lk.motormila.app.domain.model.ProSnapshot
import lk.motormila.app.domain.model.VehicleLane

fun ProSnapshotDto.toDomain(): ProSnapshot = ProSnapshot(
    generatedAt = generatedAt,
    totalListings = totalListings,
    avgPriceLkr = avgPriceLkr,
    medianPriceLkr = medianPriceLkr,
    minPriceLkr = minPriceLkr,
    maxPriceLkr = maxPriceLkr,
    newListings7d = newListings7d,
    districtsCovered = districtsCovered,
    sourceCount = sourceCount,
    hotDealCount = hotDealCount,
    lastUpdated = lastUpdated,
)

fun VehicleLaneDto.toDomain(): VehicleLane = VehicleLane(
    make = make, model = model, listingCount = listingCount,
    avgPriceLkr = avgPriceLkr, medianPriceLkr = medianPriceLkr,
    minPriceLkr = minPriceLkr, maxPriceLkr = maxPriceLkr,
    avgDealScore = avgDealScore, districtCount = districtCount,
    sourceCount = sourceCount, topDistrict = topDistrict,
    topSource = topSource, latestSeenAt = latestSeenAt,
)

fun DistrictProfileDto.toDomain(): ProDistrict = ProDistrict(
    district = district, listingCount = listingCount,
    avgPriceLkr = avgPriceLkr, medianPriceLkr = medianPriceLkr,
    minPriceLkr = minPriceLkr, maxPriceLkr = maxPriceLkr,
    sourceCount = sourceCount, topMake = topMake, topModel = topModel,
    latestSeenAt = latestSeenAt,
)

fun ArbitrageGapDto.toDomain(): ArbitrageGap = ArbitrageGap(
    buyDistrict = buyDistrict, sellDistrict = sellDistrict,
    buyMedianLkr = buyMedianLkr, sellMedianLkr = sellMedianLkr,
    gapPct = gapPct, buyListingCount = buyListingCount,
    sellListingCount = sellListingCount,
)

/**
 * ProDetailPayload is a rich object (metrics/mixes/trends/samples) but the
 * domain laneDetail/districtDetail signatures return [VehicleLane]/[ProDistrict].
 * We project the headline: title "Make Model" split, listing_count + medians
 * scraped from metrics rows ("Listings", "Median", "Average", "Min", "Max").
 */
fun LaneDetailDto.toVehicleLane(): VehicleLane {
    val metricMap = metrics.associate { it.label.lowercase() to it.value }
    fun num(keyPart: String): Double? =
        metricMap.entries.firstOrNull { keyPart in it.key }
            ?.value?.filter { c -> c.isDigit() || c == '.' }?.toDoubleOrNull()
    val titleParts = title.split(" ").filter { it.isNotBlank() }
    return VehicleLane(
        make = titleParts.getOrNull(0) ?: "",
        model = titleParts.drop(1).joinToString(" "),
        listingCount = num("listing")?.toInt() ?: 0,
        avgPriceLkr = num("average") ?: num("avg"),
        medianPriceLkr = num("median"),
        minPriceLkr = num("min"),
        maxPriceLkr = num("max"),
        avgDealScore = null,
        districtCount = districtMix.size,
        sourceCount = sourceMix.size,
        topDistrict = districtMix.firstOrNull()?.label,
        topSource = sourceMix.firstOrNull()?.label,
        latestSeenAt = generatedAt,
    )
}

fun LaneDetailDto.toProDistrict(fallbackDistrict: String): ProDistrict {
    val metricMap = metrics.associate { it.label.lowercase() to it.value }
    fun num(keyPart: String): Double? =
        metricMap.entries.firstOrNull { keyPart in it.key }
            ?.value?.filter { c -> c.isDigit() || c == '.' }?.toDoubleOrNull()
    return ProDistrict(
        district = title.ifBlank { fallbackDistrict },
        listingCount = num("listing")?.toInt() ?: 0,
        avgPriceLkr = num("average") ?: num("avg"),
        medianPriceLkr = num("median"),
        minPriceLkr = num("min"),
        maxPriceLkr = num("max"),
        sourceCount = sourceMix.size,
        topMake = null,
        topModel = null,
        latestSeenAt = generatedAt,
    )
}
