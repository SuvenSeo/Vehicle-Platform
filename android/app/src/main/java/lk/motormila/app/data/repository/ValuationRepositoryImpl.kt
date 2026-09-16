package lk.motormila.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.LandedCostRequestDto
import lk.motormila.app.data.remote.dto.OwnershipBundleRequestDto
import lk.motormila.app.data.remote.dto.TcoRequestDto
import lk.motormila.app.di.IoDispatcher
import lk.motormila.app.domain.repository.CostLine
import lk.motormila.app.domain.repository.LandedCost
import lk.motormila.app.domain.repository.LandedCostInput
import lk.motormila.app.domain.repository.OwnershipBundle
import lk.motormila.app.domain.repository.OwnershipBundleInput
import lk.motormila.app.domain.repository.PermitQuote
import lk.motormila.app.domain.repository.Tco
import lk.motormila.app.domain.repository.TcoInput
import lk.motormila.app.domain.repository.ValuationRepository

/**
 * Cost calculators. Backend expects USD-denominated CIF; the domain input is
 * LKR, converted with the live macro FX rate (fallback 300).
 */
@Singleton
class ValuationRepositoryImpl @Inject constructor(
    private val api: MotormilaApiService,
    @IoDispatcher private val io: CoroutineDispatcher,
) : ValuationRepository {

    override suspend fun landedCost(input: LandedCostInput): LandedCost = withContext(io) {
        val fx = runCatching { api.macro().usdLkr }.getOrDefault(300.0).coerceAtLeast(1.0)
        val fuel = (input.fuelType ?: "petrol").lowercase().let {
            if (it == "electric") "electric" else it
        }
        val res = api.landedCost(
            LandedCostRequestDto(
                cifUsd = input.cifValueLkr / fx,
                exchangeRate = fx,
                fuelType = fuel,
                engineCc = input.engineCc.takeIf { it > 0 },
            ),
        )
        LandedCost(
            cifLkr = res.cifLkr,
            dutyLkr = res.cid + res.surcharge + res.excise,
            vatLkr = res.vat,
            palLkr = res.sscl,
            totalLkr = res.landedCost,
            breakdown = listOf(
                CostLine("CID", res.cid),
                CostLine("Surcharge", res.surcharge),
                CostLine("Excise", res.excise),
                CostLine("SSCL (PAL)", res.sscl),
                CostLine("VAT", res.vat),
                CostLine("Luxury tax", res.luxuryTax),
            ),
        )
    }

    override suspend fun tco(input: TcoInput): Tco = tcoWithFuel(input, fuelType = "petrol")

    /** Fuel-aware overload (domain TcoInput carries no fuelType). */
    suspend fun tcoWithFuel(input: TcoInput, fuelType: String): Tco = withContext(io) {
        val res = api.tco(
            TcoRequestDto(
                dailyKm = input.monthlyKm / 30.0,
                fuelType = fuelType,
                mileageKmpl = input.kmPerLitre,
            ),
        )
        val months = (input.years * 12).coerceAtLeast(1)
        val fuelTotal = res.fuelCostMonthly * months
        val serviceTotal = res.overheadCostMonthly * months
        val total = input.priceLkr + fuelTotal + serviceTotal + res.leaseCostMonthly * months
        Tco(
            purchaseLkr = input.priceLkr,
            fuelLkr = fuelTotal,
            serviceLkr = serviceTotal,
            insuranceLkr = 0.0,
            totalLkr = total,
            monthlyLkr = total / months,
        )
    }

    override suspend fun ownershipBundle(input: OwnershipBundleInput): OwnershipBundle = withContext(io) {
        val res = api.ownershipBundle(
            OwnershipBundleRequestDto(
                vehicleClass = input.vehicleClass,
                fuelType = input.fuelType,
                engineCc = input.engineCc.takeIf { it > 0 },
                considerationLkr = input.considerationLkr,
                includeTransfer = input.includeTransfer,
            ),
        )
        OwnershipBundle(
            revenueLicenceLkr = res.revenueLicenceLkr ?: 0.0,
            insuranceLkr = res.insuranceLkr ?: 0.0,
            transferFeesLkr = res.transferFeesLkr ?: 0.0,
            emissionTestLkr = res.emissionTestLkr ?: 0.0,
            firstYearTotalLkr = res.firstYearTotalLkr
                ?: listOfNotNull(
                    res.revenueLicenceLkr,
                    res.insuranceLkr,
                    res.transferFeesLkr,
                    res.emissionTestLkr,
                ).sum(),
            notes = res.notes.orEmpty(),
        )
    }

    override suspend fun permits(): List<PermitQuote> = withContext(io) {
        api.permits().map { dto ->
            PermitQuote(
                id = dto.id,
                name = dto.permitName.ifBlank { "Permit" },
                type = dto.permitType,
                marketPriceLkr = dto.marketPriceLkr,
            )
        }
    }
}
