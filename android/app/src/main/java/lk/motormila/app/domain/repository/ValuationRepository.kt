package lk.motormila.app.domain.repository

/** Cost/ownership calculators (endpoints/calculators.py). Pure data passthrough. */
data class LandedCostInput(
    val cifValueLkr: Double,
    val engineCc: Int,
    val year: Int,
    val fuelType: String? = null,
)

data class LandedCost(
    val cifLkr: Double,
    val dutyLkr: Double,
    val vatLkr: Double,
    val palLkr: Double,
    val totalLkr: Double,
    val breakdown: List<CostLine> = emptyList(),
)

data class CostLine(
    val label: String,
    val amountLkr: Double,
)

data class TcoInput(
    val priceLkr: Double,
    val monthlyKm: Int,
    val fuelPricePerLitre: Double,
    val kmPerLitre: Double,
    val years: Int = 5,
)

data class Tco(
    val purchaseLkr: Double,
    val fuelLkr: Double,
    val serviceLkr: Double,
    val insuranceLkr: Double,
    val totalLkr: Double,
    val monthlyLkr: Double,
)

interface ValuationRepository {
    suspend fun landedCost(input: LandedCostInput): LandedCost
    suspend fun tco(input: TcoInput): Tco
}
