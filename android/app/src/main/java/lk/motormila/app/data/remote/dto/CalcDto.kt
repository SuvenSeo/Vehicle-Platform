package lk.motormila.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Calculator DTOs. Backend: endpoints/calculators.py (+ services/ownership_costs.py).
 * Response dicts from revenue/insurance/transfer/eligibility/bundle endpoints are
 * modelled leniently — every field optional.
 */
@Serializable
data class LandedCostRequestDto(
    @SerialName("cif_usd") val cifUsd: Double,
    @SerialName("exchange_rate") val exchangeRate: Double = 300.0,
    @SerialName("fuel_type") val fuelType: String,
    @SerialName("engine_cc") val engineCc: Int? = null,
    @SerialName("motor_kw") val motorKw: Int? = null,
    @SerialName("apply_surcharge") val applySurcharge: Boolean = true,
    @SerialName("apply_sscl") val applySscl: Boolean = true,
)

@Serializable
data class LandedCostResponseDto(
    @SerialName("cif_lkr") val cifLkr: Double = 0.0,
    val cid: Double = 0.0,
    val surcharge: Double = 0.0,
    val excise: Double = 0.0,
    val sscl: Double = 0.0,
    val vat: Double = 0.0,
    @SerialName("luxury_tax") val luxuryTax: Double = 0.0,
    @SerialName("total_tax") val totalTax: Double = 0.0,
    @SerialName("landed_cost") val landedCost: Double = 0.0,
    @SerialName("surcharge_applied") val surchargeApplied: Boolean = true,
    val notes: String = "",
)

@Serializable
data class TcoRequestDto(
    @SerialName("daily_km") val dailyKm: Double = 40.0,
    @SerialName("fuel_type") val fuelType: String,
    @SerialName("mileage_kmpl") val mileageKmpl: Double,
    @SerialName("lease_installment") val leaseInstallment: Double = 0.0,
    @SerialName("insurance_annual") val insuranceAnnual: Double = 120000.0,
    @SerialName("service_annual") val serviceAnnual: Double = 60000.0,
    @SerialName("tyres_annual") val tyresAnnual: Double = 30000.0,
    @SerialName("resale_loss_annual") val resaleLossAnnual: Double = 100000.0,
)

@Serializable
data class TcoResponseDto(
    @SerialName("fuel_price_lkr") val fuelPriceLkr: Double = 0.0,
    @SerialName("fuel_cost_monthly") val fuelCostMonthly: Double = 0.0,
    @SerialName("lease_cost_monthly") val leaseCostMonthly: Double = 0.0,
    @SerialName("overhead_cost_monthly") val overheadCostMonthly: Double = 0.0,
    @SerialName("total_tco_monthly") val totalTcoMonthly: Double = 0.0,
    val notes: String = "",
)

@Serializable
data class OwnershipBundleRequestDto(
    @SerialName("vehicle_class") val vehicleClass: String = "motor_car",
    @SerialName("fuel_type") val fuelType: String = "petrol",
    @SerialName("engine_cc") val engineCc: Int? = 1500,
    @SerialName("unladen_kg") val unladenKg: Double? = null,
    @SerialName("consideration_lkr") val considerationLkr: Double = 0.0,
    @SerialName("include_transfer") val includeTransfer: Boolean = false,
)

@Serializable
data class OwnershipBundleResponseDto(
    @SerialName("revenue_licence_lkr") val revenueLicenceLkr: Double? = null,
    @SerialName("insurance_lkr") val insuranceLkr: Double? = null,
    @SerialName("transfer_fees_lkr") val transferFeesLkr: Double? = null,
    @SerialName("emission_test_lkr") val emissionTestLkr: Double? = null,
    @SerialName("first_year_total_lkr") val firstYearTotalLkr: Double? = null,
    val notes: String? = null,
)

@Serializable
data class MacroDto(
    @SerialName("usd_lkr") val usdLkr: Double = 300.0,
    @SerialName("reference_date") val referenceDate: String? = null,
    val source: String = "",
    @SerialName("source_url") val sourceUrl: String = "",
    @SerialName("fetched_at") val fetchedAt: String = "",
    @SerialName("inflation_index") val inflationIndex: Double? = null,
    @SerialName("inflation_yoy_percent") val inflationYoyPercent: Double? = null,
    @SerialName("inflation_reference_date") val inflationReferenceDate: String? = null,
    val notes: String = "",
)

@Serializable
data class PermitDto(
    val id: Int? = null,
    @SerialName("permit_name") val permitName: String = "",
    @SerialName("permit_type") val permitType: String = "",
    @SerialName("market_price_lkr") val marketPriceLkr: Double = 0.0,
)

@Serializable
data class VehicleNewsItemDto(
    val title: String = "",
    val url: String? = null,
    val source: String? = null,
    @SerialName("published_at") val publishedAt: String? = null,
    val summary: String? = null,
)

@Serializable
data class RevenueLicenceRequestDto(
    @SerialName("vehicle_class") val vehicleClass: String = "motor_car",
    @SerialName("fuel_type") val fuelType: String = "petrol",
    @SerialName("unladen_kg") val unladenKg: Double? = null,
    @SerialName("engine_cc") val engineCc: Int? = null,
    val delay: String = "none",
    @SerialName("include_emission_test") val includeEmissionTest: Boolean = true,
)

@Serializable
data class RevenueLicenceResponseDto(
    @SerialName("licence_fee_lkr") val licenceFeeLkr: Double? = null,
    @SerialName("total_lkr") val totalLkr: Double? = null,
    @SerialName("emission_test_lkr") val emissionTestLkr: Double? = null,
    @SerialName("late_fee_lkr") val lateFeeLkr: Double? = null,
    val breakdown: Map<String, Double> = emptyMap(),
)

@Serializable
data class InsuranceRequestDto(
    @SerialName("vehicle_class") val vehicleClass: String = "motor_car",
    @SerialName("engine_cc") val engineCc: Int? = 1500,
)

@Serializable
data class InsuranceResponseDto(
    @SerialName("premium_lkr") val premiumLkr: Double? = null,
    @SerialName("total_lkr") val totalLkr: Double? = null,
    val breakdown: Map<String, Double> = emptyMap(),
)

@Serializable
data class TransferFeesRequestDto(
    @SerialName("vehicle_class") val vehicleClass: String = "motor_car",
    @SerialName("consideration_lkr") val considerationLkr: Double = 0.0,
    @SerialName("include_stamp_duty") val includeStampDuty: Boolean = true,
)

@Serializable
data class TransferFeesResponseDto(
    @SerialName("total_lkr") val totalLkr: Double? = null,
    @SerialName("stamp_duty_lkr") val stampDutyLkr: Double? = null,
    @SerialName("transfer_fee_lkr") val transferFeeLkr: Double? = null,
    val breakdown: Map<String, Double> = emptyMap(),
)

@Serializable
data class ImportEligibilityRequestDto(
    @SerialName("fuel_type") val fuelType: String = "hybrid",
    @SerialName("model_year") val modelYear: Int? = null,
    @SerialName("as_of_year") val asOfYear: Int = 2026,
)

@Serializable
data class ImportEligibilityResponseDto(
    val eligible: Boolean = false,
    val reason: String? = null,
    @SerialName("max_age_years") val maxAgeYears: Int? = null,
    @SerialName("vehicle_age_years") val vehicleAgeYears: Int? = null,
)
