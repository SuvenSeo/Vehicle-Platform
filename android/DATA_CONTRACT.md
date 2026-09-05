# DATA_CONTRACT.md — Motormila Android DATA layer ↔ DOMAIN layer

Owner: DATA builder. Audience: DOMAIN / UI / DI builders working in parallel.
The `domain/model/` + `domain/repository/` packages below **already exist**
(domain builder owns them). This file pins the exact signatures the DATA
implementations compile against, so any domain-side rename must update the
mappers/repositories listed here.

Base URL: `BuildConfig.BASE_URL` = `"…/api/v1"` (no trailing slash).
Auth: `Authorization: Bearer <token>` via `core/network/AuthInterceptor`.
Errors: backend `{detail}` + 401/403/404/422/429/503 → `core/common/AppError`
via `core/network/ErrorMapper`.

## 1. Domain models consumed (domain/model/, read-only for DATA)

| Domain | Source of truth | Mapper |
|---|---|---|
| `Listing(id,title,make,model,year,priceLkr,mileageKm,fuelType,transmission,condition,bodyType,district,city,source,thumbnailUrl,images,dealScore,marketMedianLkr,isActive,scrapedAt,firstSeenAt,lastSeenAt,detailUrl,externalUrl,engineCc)` + `dealBand()/formattedPrice()/deltaVsMedianPct()` + `DealBand{GREAT,FAIR,HIGH,LOCKED}` | `ListingDto` (CarListingRead). **Free-plan nulls `dealScore` stay null → LOCKED. `engineCc` = `engine_capacity`.** | `ListingMappers.kt` |
| `PriceHistory(listingId,points,firstPriceLkr,currentPriceLkr,changePct,cutCount,raiseCount,highestPriceLkr,lowestPriceLkr,lastChangeAt,trackedPoints)` + `PricePoint(priceLkr,scrapedAt)` | `PriceHistoryDto` | `ListingMappers.kt` |
| `HistoryReport(listingId,firstSeenAt,lastSeenAt,daysOnMarket,isActive,pricePoints,priceCuts,totalChangePct,relatedListings,flags,disclaimer)` + `RelatedListing` + `ReportFlag` | `HistoryReportDto` | `ListingMappers.kt` |
| `SellerProfile(source,sourceUrl,sellerName,sellerType,memberSince,listingCount,reviewCount,rating,phoneNumbers,whatsappNumbers,verifiedBadges,fetchedAt)` | `SellerProfileDto` | `ListingMappers.kt` |
| `Fmv(askingLkr,fmvLkr,dealScore,deltaPct,band,label,method,sampleCount,confidence)` | `FmvDto`: `fmv = fmv_lkr ?: predicted_price_lkr`; `delta = delta_pct ?: -price_gap_pct`; LOCKED when fmv/score null | `ListingMappers.kt` |
| `Valuation(vehicleLabel,lowLkr,medianLkr,highLkr,confidence,verdict,verdictLabel,deltaPct,comparableCount,methodology,comparables)` + `ValuationInput(make,model,year,mileageKm,condition,transmission,fuelType,bodyType,district,askingPriceLkr)` + `Comparable` | `CustomEstimateDto` / `EstimateDto` (quick band, no comparables) | `ListingMappers.kt` |
| `StatsSummary(totalListings,avgPriceLkr,priceChangeMom,goodDealsCount,listingsThisWeek,districtsCovered,sourceCount,lastUpdated)` | `StatsSummaryDto` (`districtsCovered ?: district_count`) | `StatsMappers.kt` |
| `DistrictStat(district,lat,lng,count,avgPriceLkr,medianPriceLkr,topMake,topModel,topModelCount)` | `DistrictPriceDto` (lat/lng default 0,0 when absent) | `StatsMappers.kt` |
| `TrendPoint(year,month,avgPriceLkr,medianPriceLkr,listingCount)` + `TrendSeries(points,coverageScope,coverageNote)` | `TrendSeriesDto`; `period "YYYY-MM"` parsed when year/month absent | `StatsMappers.kt` |
| `PriceIndex(basePeriod,latestPeriod,points,methodology)` + `PriceIndexPoint` | `PriceIndexDto` | `StatsMappers.kt` |
| `Insights(newListings24h,segmentPerformance,trendingModels,hotDeals)` + `SegmentPerformance/TrendingModel/HotDeal` | `InsightsDto` | `StatsMappers.kt` |
| `PriceDrop(listing,previousPriceLkr,newPriceLkr,dropPct,droppedAt)` | `PriceDropsDto.items` | `StatsMappers.kt` |
| `DistrictVelocity(district,lat,lng,listingCount,new7dCount,velocityScore)` | `DistrictVelocityDto.points` | `StatsMappers.kt` |
| `FuelMixBucket(fuelType,count,pct)` | `FuelMixBucketDto` (`pct` else `share*100`) | `StatsMappers.kt` |
| `MarketSignal(id,source,signalType,metric,valueNumeric,unit,observedAt)` | `MarketSignalDto` | `StatsMappers.kt` |
| `Alert(id,make,model,maxPriceLkr,district,notifyPhone,notifyEmail,notifyTelegramChatId,notifyChannels,active,createdAt)` + `AlertInput` (same minus id) | `AlertDto` / `CreateAlertRequestDto` (`max_price`) | `AlertMappers.kt` |
| `AlertMatch(alertId,make,model,district,maxPriceLkr,matchingCount,listings)` + `AlertMatchListing` | `MatchResponseDto.results` (match-all; filtered client-side by id) | `AlertMappers.kt` |
| `AppNotification(id,title,body,kind,listingId,isRead,createdAt)` | `NotificationDto`: `kind = "listing"` iff `link` contains `/listings/{id}`, else `"alert"`; `listingId` parsed from link | `AlertMappers.kt` |
| `VehicleLane/ProSnapshot/ProDistrict/ArbitrageGap` | `VehicleLaneDto/ProSnapshotDto/DistrictProfileDto/ArbitrageGapDto` | `ProMappers.kt` |
| `UserSession(email,name,plan,role,subscriptionStatus,token,expiresAt)` | `TokenResponse{user,token,expires_at(epoch s→ISO)}` + `MeResponse` | `AuthRepositoryImpl` |
| `WatchItem(listingId,title,thumbnailUrl,priceAtAddLkr,lastKnownPriceLkr,addedAtEpochMs)` | Local-only (`WatchlistEntity`); prices refreshed via `GET /listings/{id}` | `WatchlistRepositoryImpl` |
| `ChatMessage(role,content)` | `ChatResponseDto.text()` (reply?:message?:response?:answer?) | `ChatRepositoryImpl` |
| `DealerBenchmark(dealerName,listingCount,avgPriceLkr,medianPriceLkr,avgDealScore,district)` | Aggregated client-side from `POST /dealer/benchmark-urls` results | `DealerRepositoryImpl` |
| `DealerClaim(claimId,status,message)` | `DealerClaimResponseDto` (claim_token persisted in SettingsStore) | `DealerRepositoryImpl` |
| `LandedCostInput(cifValueLkr,engineCc,year,fuelType)` → `LandedCost(cifLkr,dutyLkr,vatLkr,palLkr,totalLkr,breakdown)` | `POST /calculators/landed-cost`: `cif_usd = cifValueLkr / macro.usd_lkr`; duty=cid+surcharge+excise, pal=sscl | `ValuationRepositoryImpl` |
| `TcoInput(priceLkr,monthlyKm,fuelPricePerLitre,kmPerLitre,years)` → `Tco(purchaseLkr,fuelLkr,serviceLkr,insuranceLkr,totalLkr,monthlyLkr)` | `POST /calculators/tco`: `daily_km=monthlyKm/30`, fuelType inferred from `kmPerLitre`? No — caller passes via `ValuationRepository.tcoWithFuel()`… see §4 | `ValuationRepositoryImpl` |

## 2. Repository interfaces implemented (domain/repository/, read-only)

`AuthRepository` (session/me/login/signup/logout/restore),
`ListingRepository` (paging/query/getDetail/similar/priceHistory/historyReport/fmv/sellerProfile/sources/makes/models/suggestions/estimate/customEstimate),
`StatsRepository` (summary/summaryStream/insights/trends/priceIndex/districtPrices/districtVelocity/priceDrops/fuelMix/marketSignals/liveListings/evInsight),
`AlertsRepository` (observeAlerts/refresh/create/**update**=delete+create/**setActive**=local+refresh/**match(id)**=match-all+filter/observeNotifications/notifications/markNotificationRead/unreadCount),
`WatchlistRepository` (observe/isWatched/toggle/add/remove/clear/refreshPrices),
`ValuationRepository` (landedCost/tco),
`ProRepository` (snapshot/lanes/districts/laneDetail/districtDetail/arbitrage),
`ChatRepository` (ask),
`DealerRepository` (claim/benchmark/myClaimStatus).

Backend gaps handled client-side (no 500s): `update`/`setActive` (no PUT /alerts),
per-id match (match-all + filter), `myClaimStatus` (cached claim_token; null when absent),
`liveListings` (poll `GET /listings?sort=newest&size=N`), `summaryStream` (poll 60 s),
`districtPrices` (district-prices ∪ district-insight top-models), trends/model fallback
(model-price-history → trends), `hybrid-bands/source-quality/import-era-split/ev-charging/
safety/geo/news/macro/permits/revenue/insurance/transfer/eligibility/bundle` exposed as
`suspend` helpers on the same impl classes (no domain interface change needed).

## 3. Local persistence owned by DATA (Room v1 `MotormilaDatabase`)

Entities: `ListingEntity`(PK id, images as `||`-CSV), `PricePointEntity`(PK auto, index listingId),
`WatchlistEntity`(PK listingId), `AlertEntity`(mirror of Alert + `dirty` flag),
`DistrictStatEntity`(PK district), `RemoteKeysEntity`(PK queryHash: prev/next page + updatedAt),
`StatsCacheEntity`(PK key, json, updatedAt; TTL 15 min for snapshot/stats).
DAOs expose `Flow` reads; writes are `suspend`. FTS = simple `LIKE` (no FTS4 table).
**No destructive migration in release** (`fallbackToDestructiveMigration` is debug-only).

## 4. Notes for DOMAIN builder (do not break)

- `TcoInput` has no `fuelType`; DATA calls TCO with `fuelType="petrol"` unless the UI
  passes its own fuel via `ValuationRepositoryImpl.tcoWithFuel(input, fuelType)` overload
  (extra method on the impl, not the interface).
- `DealerRepository.benchmark(dealerName)` takes a name, but the backend benchmarks
  **URLs**; DATA also exposes `benchmarkUrls(urls)` on the impl for the yard-tools UI.
- `StatsRepository.evInsight` returns `TrendSeries`; model leaderboard is dropped
  (available via `StatsRepositoryImpl.evModels()` helper).
- `Alert.active` toggles are local-only until backend supports PATCH; `dirty` alerts
  are reconciled on next `refresh()`.
- All suspend IO runs on `@IoDispatcher` (see `di/DispatcherModule`); paging uses
  `ListingPagingSource` (network-only) by default, `ListingRemoteMediator` + Room when
  the UI passes `cached=true` (pager factory lives in `ListingRepositoryImpl.paging`).
