package lk.motormila.app.ui.docs

data class DocsSection(
    val id: String,
    val title: String,
    val summary: String,
    val body: List<String>,
    val bullets: List<String> = emptyList(),
)

object DocsCatalog {
    val sections: List<DocsSection> = listOf(
        DocsSection(
            id = "overview",
            title = "What Motormila is",
            summary = "Sri Lanka vehicle market intelligence — listings, deal scores, and decision tools in one cockpit.",
            body = listOf(
                "Motormila is a vehicle intelligence platform built for the Sri Lankan used and import market. It aggregates public listings, scores how asking prices sit against condition-aware peers, and surfaces tools dealers, brokers, importers, and serious buyers actually use before they negotiate.",
                "The public dashboard is the front door: browse live inventory, filter by make, model, district, and fuel type, then drill into deal signals, trends, and valuation. Paid workspaces add depth — history, exports, dealer inventory ops, and Official Pulse signals from DMT, Customs, and import policy.",
            ),
            bullets = listOf(
                "Public market browse on the home dashboard",
                "Deal scores and fair-ask context on listings",
                "Trends, price index, alerts, and calculator",
                "Pro terminal and Dealer workspace for paid teams",
            ),
        ),
        DocsSection(
            id = "data-sources",
            title = "Data sources",
            summary = "Listings sync from major Sri Lankan marketplaces — ikman, riyasewana, and other high-volume boards.",
            body = listOf(
                "Motormila scrapes and normalizes vehicle ads from the boards Sri Lankans already use. Primary coverage includes ikman and riyasewana, with additional volume from AutoLanka, Patpat, AutoDirect, HitAd, Cartivate, and related classified or dealer sources.",
                "Each listing is deduplicated where possible, mapped to a shared make/model schema, and tagged with district, fuel type, year, mileage, and asking price.",
            ),
            bullets = listOf(
                "ikman — high-volume national classifieds",
                "riyasewana — strong vehicle-specific inventory",
                "AutoLanka, Patpat, AutoDirect, HitAd, Cartivate — supplemental lanes",
                "Normalized schema across boards for comparable medians",
            ),
        ),
        DocsSection(
            id = "deal-scores",
            title = "How deal scores work",
            summary = "Scores compare asking price to a market median — Good Deal, Fair, or Overpriced.",
            body = listOf(
                "A deal score answers one question: is this asking price cheap, fair, or rich versus peers? The core formula is score = (1 − price / median) × 100. Positive scores mean under-median; negative scores mean over-median.",
                "Bands: Good Deal when score ≥ 8, Overpriced when score ≤ −5, and Fair otherwise. Treat strong scores with thin samples as provisional.",
            ),
            bullets = listOf(
                "Good Deal: score ≥ 8 (asking ≤ ~92% of median)",
                "Fair: between the Good Deal and Overpriced bands",
                "Overpriced: score ≤ −5 (asking ≥ ~105% of median)",
                "Confidence rises with sample size and fresh comps",
            ),
        ),
        DocsSection(
            id = "official-pulse",
            title = "Official Pulse",
            summary = "DMT, Customs, and import-policy signals that sit beside marketplace prices.",
            body = listOf(
                "Official Pulse tracks government and regulatory signals that move landed cost and registration risk — DMT process notes, Customs duty context, and import-policy changes that dealers and importers watch weekly.",
                "Pulse is not a substitute for a lawyer or clearing agent. It is a structured feed of signals linked to how Motormila models import cost and market pressure.",
            ),
            bullets = listOf(
                "DMT and registration-side process signals",
                "Customs and duty context for import lanes",
                "Import-policy and surcharge timing cues",
                "History and depth on paid plans",
            ),
        ),
        DocsSection(
            id = "calculator",
            title = "Import duty calculator",
            summary = "Landed cost, surcharge assumptions, lease, TCO, and permit context for imports.",
            body = listOf(
                "The calculator models landed cost from CIF, live CBSL-linked FX, fuel type, engine capacity or motor kW, and common surcharges. Additional tabs cover lease repayment, total cost of ownership, on-road fees, import eligibility, permits, and depreciation.",
            ),
            bullets = listOf(
                "CIF → LKR landed cost with fuel and CC/kW inputs",
                "Live USD/LKR FX",
                "On-road statutory fees: revenue licence, VET, CMT, transfer",
                "Post-ban import eligibility screen",
            ),
        ),
        DocsSection(
            id = "pricing-access",
            title = "Pricing & access",
            summary = "Free browse, Pro terminal, Dealer workspace, and Custom plans.",
            body = listOf(
                "Access is tiered with soft limits on Free — every product page is open, but depth is capped. Pro unlocks the terminal, scores, pulse history, alerts depth, and exports. Dealer includes everything in Pro plus the yard workspace.",
            ),
            bullets = listOf(
                "Free — open pages with soft limits",
                "Pro — LKR 999/mo terminal, scores, history, alerts, exports",
                "Dealer — LKR 1,999/mo = Pro + yard workspace",
                "Custom — message us for institutional scope",
            ),
        ),
        DocsSection(
            id = "trust-freshness",
            title = "Trust & pipeline freshness",
            summary = "How sync cadence, stale labels, and confidence interact with deal scores.",
            body = listOf(
                "Listing sync and analytical refresh are related but not identical. Freshness labels reflect operational sync recency — not a claim that every median was recomputed in the last minute.",
                "Listings older than the stale threshold are marked so you do not negotiate off cold inventory.",
            ),
            bullets = listOf(
                "Operational freshness ≠ full market recalculation",
                "Stale labels protect you from cold asks",
                "Sample depth drives deal-score confidence",
            ),
        ),
    )

    fun byId(id: String): DocsSection? = sections.firstOrNull { it.id == id }
}
