package lk.motormila.app.ui.pulse

data class PulseSourceGuide(
    val key: String,
    val source: String,
    val signalType: String,
    val title: String,
    val shortLabel: String,
    val summary: String,
    val whyItMatters: List<String>,
    val howWeReadIt: List<String>,
    val dealerTip: String,
)

object PulseGuides {
    val all: List<PulseSourceGuide> = listOf(
        PulseSourceGuide(
            key = "dmt_registrations",
            source = "dmt",
            signalType = "registrations",
            title = "DMT registrations",
            shortLabel = "Registrations",
            summary = "Vehicle registration document and activity signals published by the Department of Motor Traffic (DMT.gov.lk).",
            whyItMatters = listOf(
                "Registration volume is an early read on how many vehicles are entering the formal on-road fleet.",
                "Shifts in document activity often precede listing-supply changes on consumer marketplaces.",
                "Dealers use registration pace to judge whether a segment is heating up or cooling before prices move.",
            ),
            howWeReadIt = listOf(
                "We track DMT registration-related documents and page activity as a proxy pulse, not a raw VIN-level feed.",
                "Higher document counts in a period usually mean more registration paperwork is circulating for that window.",
                "Compare the latest period against recent months to spot acceleration or slowdown, not day-to-day noise.",
            ),
            dealerTip = "When registration documents spike for a segment you stock, expect more competing inventory within 2–6 weeks — tighten ask prices early rather than waiting for aged stock.",
        ),
        PulseSourceGuide(
            key = "dmt_transfers",
            source = "dmt",
            signalType = "transfers",
            title = "DMT transfers",
            shortLabel = "Transfers",
            summary = "Ownership transfer document signals from DMT.gov.lk — a proxy for how actively vehicles are changing hands.",
            whyItMatters = listOf(
                "Transfer activity reflects completed ownership changes, not just ads or inquiries.",
                "Rising transfers with flat listings can signal off-market liquidity or faster close rates.",
            ),
            howWeReadIt = listOf(
                "We monitor DMT transfer-related documents and page signals as an ownership-change pulse.",
                "Read transfers alongside registrations — registrations add fleet stock; transfers show that stock is actually moving.",
            ),
            dealerTip = "If transfers stay strong while your lot days-on-market climb, the market is still liquid — revisit pricing and presentation before blaming demand.",
        ),
        PulseSourceGuide(
            key = "customs_tenders",
            source = "customs",
            signalType = "tender_sales",
            title = "Customs tender sales",
            shortLabel = "Tenders",
            summary = "Vehicle tender activity monitored on customs.gov.lk — official sales channels that can inject supply into the trade.",
            whyItMatters = listOf(
                "Customs tenders can release batches of vehicles outside normal dealer wholesale channels.",
                "Sudden tender volume can pressure retail prices in nearby segments once units hit the open market.",
            ),
            howWeReadIt = listOf(
                "We scan Sri Lanka Customs tender-sales pages for vehicle-related tender links and activity counts.",
                "A rising tender count is a supply-side heads-up, not a guaranteed retail price drop the next day.",
            ),
            dealerTip = "Before matching a low retail ask after a tender wave, confirm whether those units actually reach your segment — many tender lots stay wholesale or specialty channels.",
        ),
        PulseSourceGuide(
            key = "import_parity",
            source = "import_parity",
            signalType = "landed_cost",
            title = "Import parity & landed cost",
            shortLabel = "Landed cost",
            summary = "Import reference and landed-cost availability signals — whether parity / CIF-style reference pages are live for dealer cost checks.",
            whyItMatters = listOf(
                "Landed-cost references anchor what a replacement import would cost before retail margin.",
                "When parity sources are available, dealers can sanity-check used asks against replacement cost.",
            ),
            howWeReadIt = listOf(
                "We treat this as an availability / reference pulse: whether import parity or landed-cost reference pages respond.",
                "Use the signal as a readiness check, then open the calculator for a live scenario.",
            ),
            dealerTip = "If parity references go dark, lean harder on Motormila lane medians and Official Pulse duty notes until CIF pages recover.",
        ),
    )

    fun match(source: String?, signalType: String?): PulseSourceGuide? {
        val src = source.orEmpty().lowercase()
        val type = signalType.orEmpty().lowercase()
        return all.firstOrNull { it.source.equals(src, true) && it.signalType.equals(type, true) }
            ?: all.firstOrNull { it.source.equals(src, true) }
            ?: all.firstOrNull { it.signalType.equals(type, true) }
    }

    fun byKey(key: String): PulseSourceGuide? =
        all.firstOrNull { it.key.equals(key, ignoreCase = true) }
            ?: match(key.substringBefore('_'), key.substringAfter('_', missingDelimiterValue = ""))
}
