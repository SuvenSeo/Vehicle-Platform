package lk.motormila.app.data.remote.mapper

import lk.motormila.app.data.remote.dto.DistrictPriceDto
import lk.motormila.app.data.remote.dto.DistrictVelocityPointDto
import lk.motormila.app.data.remote.dto.EvInsightDto
import lk.motormila.app.data.remote.dto.FuelMixBucketDto
import lk.motormila.app.data.remote.dto.HotDealDto
import lk.motormila.app.data.remote.dto.InsightsDto
import lk.motormila.app.data.remote.dto.MarketSignalDto
import lk.motormila.app.data.remote.dto.PriceDropItemDto
import lk.motormila.app.data.remote.dto.PriceIndexDto
import lk.motormila.app.data.remote.dto.SegmentPerformanceDto
import lk.motormila.app.data.remote.dto.StatsSummaryDto
import lk.motormila.app.data.remote.dto.TrendPointDto
import lk.motormila.app.data.remote.dto.TrendSeriesDto
import lk.motormila.app.data.remote.dto.TrendingModelDto
import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.DistrictVelocity
import lk.motormila.app.domain.model.FuelMixBucket
import lk.motormila.app.domain.model.HotDeal
import lk.motormila.app.domain.model.Insights
import lk.motormila.app.domain.model.MarketSignal
import lk.motormila.app.domain.model.PriceDrop
import lk.motormila.app.domain.model.PriceIndex
import lk.motormila.app.domain.model.PriceIndexPoint
import lk.motormila.app.domain.model.SegmentPerformance
import lk.motormila.app.domain.model.StatsSummary
import lk.motormila.app.domain.model.TrendPoint
import lk.motormila.app.domain.model.TrendSeries
import lk.motormila.app.domain.model.TrendingModel

/** Stats/market mappings. Backend months may arrive as "YYYY-MM" period strings. */
fun StatsSummaryDto.toDomain(): StatsSummary = StatsSummary(
    totalListings = totalListings,
    avgPriceLkr = avgPriceLkr,
    priceChangeMom = priceChangeMom,
    goodDealsCount = goodDealsCount,
    listingsThisWeek = listingsThisWeek,
    districtsCovered = districtsCovered.takeIf { it != 0 } ?: districtCount ?: 0,
    sourceCount = sourceCount,
    lastUpdated = lastUpdated,
)

fun DistrictPriceDto.toDomain(): DistrictStat = DistrictStat(
    district = district,
    lat = lat ?: 0.0,
    lng = lng ?: 0.0,
    count = count,
    avgPriceLkr = avgPriceLkr,
    medianPriceLkr = medianPriceLkr,
    topMake = topMake,
    topModel = topModel,
    topModelCount = topModelCount,
)

fun DistrictVelocityPointDto.toDomain(): DistrictVelocity = DistrictVelocity(
    district = district, lat = lat, lng = lng,
    listingCount = listingCount, new7dCount = new7dCount,
    velocityScore = velocityScore,
)

fun TrendPointDto.toDomain(): TrendPoint {
    var y = year
    var m = month
    if ((y == null || m == null) && period != null) {
        val parts = period.split("-")
        y = parts.getOrNull(0)?.toIntOrNull()
        m = parts.getOrNull(1)?.toIntOrNull()
    }
    return TrendPoint(
        year = y ?: 0,
        month = m ?: 0,
        avgPriceLkr = avgPriceLkr,
        medianPriceLkr = medianPriceLkr,
        listingCount = listingCount,
    )
}

fun TrendSeriesDto.toDomain(): TrendSeries =
    TrendSeries(points = points.map { it.toDomain() }, coverageScope = coverageScope, coverageNote = coverageNote)

fun PriceIndexDto.toDomain(): PriceIndex = PriceIndex(
    basePeriod = basePeriod,
    latestPeriod = latestPeriod,
    points = points.map {
        PriceIndexPoint(
            period = it.period, indexValue = it.indexValue,
            medianPriceLkr = it.medianPriceLkr, listingCount = it.listingCount,
            momChangePct = it.momChangePct,
        )
    },
    methodology = methodology,
)

fun SegmentPerformanceDto.toDomain(): SegmentPerformance = SegmentPerformance(
    segment = segment, listingCount = listingCount,
    avgPriceLkr = avgPriceLkr, changePct30d = changePct30d,
)

fun TrendingModelDto.toDomain(): TrendingModel = TrendingModel(
    make = make, model = model, listingCount = listingCount,
    avgPriceLkr = avgPriceLkr, movementPct = movementPct, thumbnailUrl = thumbnailUrl,
)

fun HotDealDto.toDomain(): HotDeal = HotDeal(
    id = id, make = make, model = model, year = year, district = district,
    source = source, priceLkr = priceLkr, dealScore = dealScore, thumbnailUrl = thumbnailUrl,
)

fun InsightsDto.toDomain(): Insights = Insights(
    newListings24h = newListings24h,
    segmentPerformance = segmentPerformance.map { it.toDomain() },
    trendingModels = trendingModels.map { it.toDomain() },
    hotDeals = hotDeals.map { it.toDomain() },
)

fun PriceDropItemDto.toDomain(): PriceDrop = PriceDrop(
    listing = listing.toDomain(),
    previousPriceLkr = previousPriceLkr,
    newPriceLkr = newPriceLkr,
    dropPct = dropPct,
    droppedAt = droppedAt,
)

fun FuelMixBucketDto.toDomain(total: Int = 0): FuelMixBucket {
    val pctValue = if (pct != 0.0) pct else (share ?: 0.0).let { if (it <= 1.0) it * 100.0 else it }
    return FuelMixBucket(fuelType = fuelType, count = count, pct = pctValue)
}

fun MarketSignalDto.toDomain(): MarketSignal = MarketSignal(
    id = id, source = source, signalType = signalType, metric = metric,
    valueNumeric = valueNumeric, unit = unit, observedAt = observedAt,
)

/** EV insight endpoint returns top models + trend; surfaced as TrendSeries. */
fun EvInsightDto.toTrendSeries(): TrendSeries =
    TrendSeries(points = trendPoints.map { it.toDomain() }, coverageScope = "exact", coverageNote = null)
