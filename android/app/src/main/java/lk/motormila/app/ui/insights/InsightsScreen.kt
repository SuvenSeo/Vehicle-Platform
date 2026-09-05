package lk.motormila.app.ui.insights

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ElectricCar
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Power
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.format.formatLkrCompact
import lk.motormila.app.core.format.formatPct
import lk.motormila.app.core.ui.ErrorRetry
import lk.motormila.app.core.ui.SectionTitle
import lk.motormila.app.core.ui.SkeletonList
import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.PriceIndexPoint
import lk.motormila.app.domain.model.TrendPoint
import lk.motormila.app.ui.theme.MotormilaGood
import lk.motormila.app.ui.theme.MotormilaGoodText
import lk.motormila.app.ui.theme.MotormilaOnPrimary
import lk.motormila.app.ui.theme.MotormilaOnSurface
import lk.motormila.app.ui.theme.MotormilaOutline
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaSecondaryText
import lk.motormila.app.ui.theme.MotormilaSurface
import lk.motormila.app.ui.theme.MotormilaSurfaceHigh
import lk.motormila.app.ui.theme.MotormilaWarn

private val tabs = listOf("Trends", "EV Intelligence", "Index", "Districts", "Pulse")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InsightsScreen(
    onOpenPulseDetail: (signalId: String) -> Unit,
    onDrillDistrict: (district: String) -> Unit,
    onSearchModels: (query: String) -> Unit,
    viewModel: InsightsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    var tab by remember { mutableIntStateOf(0) }

    LaunchedEffect(state.error) {
        state.error?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(InsightsUiEvent.DismissError)
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Market insights") }) },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            PrimaryTabRow(selectedTabIndex = tab) {
                tabs.forEachIndexed { i, title ->
                    Tab(
                        selected = tab == i,
                        onClick = { tab = i },
                        text = { Text(title) },
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
            }
            PullToRefreshBox(
                isRefreshing = state.isRefreshing,
                onRefresh = { viewModel.onEvent(InsightsUiEvent.Refresh) },
                modifier = Modifier.fillMaxSize(),
            ) {
                when {
                    state.isLoading -> SkeletonList()
                    state.error != null && state.trends.isEmpty() && state.index.isEmpty() ->
                        ErrorRetry(state.error ?: "Error", onRetry = { viewModel.onEvent(InsightsUiEvent.Refresh) })

                    else -> when (tab) {
                        0 -> TrendsTab(state, viewModel, onSearchModels)
                        1 -> EvTab(state, viewModel)
                        2 -> IndexTab(state)
                        3 -> DistrictsTab(state, onDrillDistrict)
                        else -> PulseTab(state, onOpenPulseDetail)
                    }
                }
            }
        }
    }
}

// ---------- 1. Trend Studio Module ----------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TrendsTab(
    state: InsightsUiState,
    viewModel: InsightsViewModel,
    onSearchModels: (String) -> Unit,
) {
    val s = state.selectors
    val popularMakes = listOf("Toyota", "Honda", "Nissan", "Suzuki", "BMW", "Hyundai")
    val popularModels = when (s.make.lowercase().trim()) {
        "toyota" -> listOf("Premio", "Aqua", "Axio", "Vitz", "Prius", "Vezel")
        "honda" -> listOf("Grace", "Vezel", "Fit", "Civic", "Insight")
        "suzuki" -> listOf("Alto", "Wagon R", "Swift", "Spacia")
        else -> listOf("Premio", "Aqua", "Grace", "Alto", "Vezel")
    }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Hero Header: Eyebrow Pill, Headline with negative letter spacing, Subtitle
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(
                    shape = RoundedCornerShape(50),
                    color = MotormilaSurfaceHigh,
                    border = BorderStroke(1.dp, MotormilaOutline),
                ) {
                    Text(
                        text = "• TREND STUDIO",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MotormilaPrimaryBright,
                        ),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }

                Text(
                    text = "Price trends.",
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.5).sp,
                        color = MotormilaOnSurface,
                    ),
                )

                Text(
                    text = "District-aware price movement, historical trajectory, and mix-adjusted bands from verified listings.",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = MotormilaSecondaryText,
                        lineHeight = 20.sp,
                    ),
                )
            }
        }

        // Selectors Card (16dp rounded glass card)
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = "MARKET FILTERS",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MotormilaSecondaryText,
                        ),
                    )

                    // Make & Model Row
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        InsightTextField("Make", s.make, Modifier.weight(1f)) {
                            viewModel.onEvent(InsightsUiEvent.SelectorsChanged(s.copy(make = it)))
                        }
                        InsightTextField("Model", s.model, Modifier.weight(1f)) {
                            viewModel.onEvent(InsightsUiEvent.SelectorsChanged(s.copy(model = it)))
                        }
                    }

                    // Quick Make Chips
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        popularMakes.forEach { makeName ->
                            FilterChip(
                                selected = s.make.equals(makeName, ignoreCase = true),
                                onClick = {
                                    val nextMake = if (s.make.equals(makeName, ignoreCase = true)) "" else makeName
                                    viewModel.onEvent(InsightsUiEvent.SelectorsChanged(s.copy(make = nextMake)))
                                },
                                label = { Text(makeName, fontSize = 11.sp) },
                                modifier = Modifier.heightIn(min = 32.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                    selectedLabelColor = MotormilaPrimaryBright,
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = s.make.equals(makeName, ignoreCase = true),
                                    borderColor = MotormilaOutline,
                                    selectedBorderColor = MotormilaPrimary,
                                ),
                            )
                        }
                    }

                    // Condition & District Row
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        InsightTextField("Condition", s.condition, Modifier.weight(1f)) {
                            viewModel.onEvent(InsightsUiEvent.SelectorsChanged(s.copy(condition = it)))
                        }
                        InsightTextField("District", s.district, Modifier.weight(1f)) {
                            viewModel.onEvent(InsightsUiEvent.SelectorsChanged(s.copy(district = it)))
                        }
                    }

                    // Quick District Chips
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("All districts", "Colombo", "Kandy", "Gampaha", "Kurunegala").forEach { dist ->
                            FilterChip(
                                selected = s.district.equals(dist, ignoreCase = true),
                                onClick = {
                                    viewModel.onEvent(InsightsUiEvent.SelectorsChanged(s.copy(district = dist)))
                                },
                                label = { Text(dist, fontSize = 11.sp) },
                                modifier = Modifier.heightIn(min = 32.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                    selectedLabelColor = MotormilaPrimaryBright,
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = s.district.equals(dist, ignoreCase = true),
                                    borderColor = MotormilaOutline,
                                    selectedBorderColor = MotormilaPrimary,
                                ),
                            )
                        }
                    }
                }
            }
        }

        // Median Price Movement Chart with ±10% Confidence Band
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "MEDIAN PRICE MOVEMENT (±10% BAND)",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.8.sp,
                                color = MotormilaSecondaryText,
                            ),
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Box(Modifier.size(8.dp).clip(CircleShape).background(MotormilaPrimaryBright))
                                Text("Median", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText))
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Box(Modifier.size(8.dp).clip(RoundedCornerShape(2.dp)).background(MotormilaPrimary.copy(alpha = 0.25f)))
                                Text("±10% Band", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText))
                            }
                        }
                    }

                    // Key metric callout
                    val latestPoint = state.trends.lastOrNull()
                    if (latestPoint != null) {
                        val med = latestPoint.medianPriceLkr ?: latestPoint.avgPriceLkr ?: 0.0
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom,
                        ) {
                            Column {
                                Text(
                                    text = formatLkr(med),
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = MotormilaOnSurface,
                                    ),
                                )
                                Text(
                                    text = "Latest tracked median · ${latestPoint.listingCount} listings",
                                    style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                                )
                            }
                            Text(
                                text = "${state.trends.size} monthly periods",
                                style = MaterialTheme.typography.labelSmall.copy(color = MotormilaPrimaryBright),
                            )
                        }
                    }

                    Spacer(Modifier.height(4.dp))

                    BandChart(
                        points = state.trends,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp)
                            .semantics { contentDescription = "Price trend chart, ${state.trends.size} points" },
                    )

                    state.trendCoverageNote?.let {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MotormilaSurface,
                            border = BorderStroke(1.dp, MotormilaOutline),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                text = "Scope: $it",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = MotormilaSecondaryText,
                                    fontSize = 11.sp,
                                ),
                                modifier = Modifier.padding(8.dp),
                            )
                        }
                    }
                }
            }
        }

        // Search Listings CTA
        item {
            val query = "${s.make} ${s.model}".trim().ifBlank { "All listings" }
            Button(
                onClick = { onSearchModels("${s.make} ${s.model}".trim()) },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MotormilaPrimary,
                    contentColor = MotormilaOnPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
            ) {
                Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Search $query in live inventory", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun InsightTextField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MotormilaPrimary,
            unfocusedBorderColor = MotormilaOutline,
            focusedContainerColor = MotormilaSurface,
            unfocusedContainerColor = MotormilaSurface,
            focusedTextColor = MotormilaOnSurface,
            unfocusedTextColor = MotormilaOnSurface,
            focusedLabelColor = MotormilaPrimaryBright,
            unfocusedLabelColor = MotormilaSecondaryText,
        ),
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
    )
}

/** Median line + shaded ±10% band with bounding guides. */
@Composable
private fun BandChart(points: List<TrendPoint>, modifier: Modifier = Modifier) {
    val medianColor = MotormilaPrimary
    val bandColor = MotormilaPrimary.copy(alpha = 0.16f)
    val boundaryColor = MotormilaPrimary.copy(alpha = 0.35f)

    Canvas(modifier) {
        if (points.size < 2) return@Canvas
        fun med(p: TrendPoint): Float = ((p.medianPriceLkr ?: p.avgPriceLkr ?: 0.0)).toFloat()
        val meds = points.map { med(it) }
        val p75 = meds.map { it * 1.10f }
        val p25 = meds.map { it * 0.90f }
        val all = meds + p75 + p25
        val min = (all.minOrNull() ?: 0f)
        val max = (all.maxOrNull() ?: 1f)
        val span = (max - min).takeIf { it > 0 } ?: 1f
        fun x(i: Int) = size.width * i / (points.size - 1)
        fun y(v: Float) = size.height - ((v - min) / span) * size.height

        // Band polygon
        val bandPath = Path().apply {
            p75.forEachIndexed { i, v -> if (i == 0) moveTo(x(i), y(v)) else lineTo(x(i), y(v)) }
            p25.indices.reversed().forEach { r -> lineTo(x(r), y(p25[r])) }
            close()
        }
        drawPath(bandPath, bandColor)

        // Upper and lower boundary lines
        for (i in 1 until points.size) {
            drawLine(boundaryColor, Offset(x(i - 1), y(p75[i - 1])), Offset(x(i), y(p75[i])), strokeWidth = 1.5f)
            drawLine(boundaryColor, Offset(x(i - 1), y(p25[i - 1])), Offset(x(i), y(p25[i])), strokeWidth = 1.5f)
        }

        // Median line
        for (i in 1 until points.size) {
            drawLine(medianColor, Offset(x(i - 1), y(meds[i - 1])), Offset(x(i), y(meds[i])), strokeWidth = 4.5f)
        }

        // Node points on median
        meds.forEachIndexed { i, v ->
            drawCircle(color = MotormilaPrimaryBright, radius = 4f, center = Offset(x(i), y(v)))
        }
    }
}

// ---------- 2. EV Intelligence Module ----------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EvTab(state: InsightsUiState, viewModel: InsightsViewModel) {
    val ev = state.ev

    LazyColumn(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Hero Header: Eyebrow Pill, Headline with negative letter spacing, Subtitle
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(
                    shape = RoundedCornerShape(50),
                    color = MotormilaSurfaceHigh,
                    border = BorderStroke(1.dp, MotormilaOutline),
                ) {
                    Text(
                        text = "• ⚡ EV INTELLIGENCE",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MotormilaPrimaryBright,
                        ),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }

                Text(
                    text = "EV buying signals.",
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.5).sp,
                        color = MotormilaOnSurface,
                    ),
                )

                Text(
                    text = "Battery health, charging fit, and duty signals for the Sri Lankan EV market.",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = MotormilaSecondaryText,
                        lineHeight = 20.sp,
                    ),
                )
            }
        }

        // Metric Cards Grid: ELECTRIC LISTINGS LIVE: 599, EV MARKET SHARE: 0.3%
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    // Metric 1: ELECTRIC LISTINGS LIVE: 599
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                        border = BorderStroke(1.dp, MotormilaOutline),
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                text = "ELECTRIC LISTINGS LIVE",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.8.sp,
                                    fontSize = 10.sp,
                                    color = MotormilaSecondaryText,
                                ),
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = (ev?.count ?: 599).toString(),
                                style = MaterialTheme.typography.headlineMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 28.sp,
                                    color = MotormilaPrimaryBright,
                                ),
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = "Tracked across all SL portals",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = MotormilaSecondaryText,
                                    fontSize = 11.sp,
                                ),
                            )
                        }
                    }

                    // Metric 2: EV MARKET SHARE: 0.3%
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                        border = BorderStroke(1.dp, MotormilaOutline),
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                text = "EV MARKET SHARE",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.8.sp,
                                    fontSize = 10.sp,
                                    color = MotormilaSecondaryText,
                                ),
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = ev?.let { "%.1f%%".format(it.sharePct) } ?: "0.3%",
                                style = MaterialTheme.typography.headlineMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 28.sp,
                                    color = MotormilaGood,
                                ),
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = "Of total verified vehicle stock",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = MotormilaSecondaryText,
                                    fontSize = 11.sp,
                                ),
                            )
                        }
                    }
                }

                // Secondary Metric Cards
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                        border = BorderStroke(1.dp, MotormilaOutline),
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(
                                text = "MEDIAN EV PRICE",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                    color = MotormilaSecondaryText,
                                ),
                            )
                            Text(
                                text = ev?.medianLkr?.let { formatLkrCompact(it) } ?: "LKR 14.5M",
                                style = MaterialTheme.typography.bodyLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = MotormilaOnSurface,
                                ),
                            )
                            Text(
                                text = "Hybrid benchmark: ${ev?.aquaMedianLkr?.let { formatLkrCompact(it) } ?: "LKR 11.2M"}",
                                style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText, fontSize = 10.sp),
                            )
                        }
                    }

                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                        border = BorderStroke(1.dp, MotormilaOutline),
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(
                                text = "ANNUAL FUEL SAVINGS",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                    color = MotormilaSecondaryText,
                                ),
                            )
                            Text(
                                text = ev?.savingsPerYearLkr?.let { formatLkrCompact(it) } ?: "LKR 440K/yr",
                                style = MaterialTheme.typography.bodyLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = MotormilaGood,
                                ),
                            )
                            Text(
                                text = "Payback recovery ~2.5 yrs",
                                style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText, fontSize = 10.sp),
                            )
                        }
                    }
                }
            }
        }

        // EV Decision Modules (Battery Health, Duty, Charging Fit)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "BUYING SIGNALS & DECISION GUIDELINES",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = MotormilaSecondaryText,
                    ),
                )

                // 1. Battery Health
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                    border = BorderStroke(1.dp, MotormilaOutline),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Filled.BatteryChargingFull, contentDescription = null, tint = MotormilaPrimaryBright)
                                Text("Battery Health & Degradation", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                            }
                            Text("01 • SOH", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = MotormilaPrimaryBright))
                        }
                        Text(
                            text = "Insist on an OBD-II diagnostic report before placing a deposit. Maintain a 20%–30% reserve buffer for daily commuting. Japanese domestic imports (Leaf, e-Note, Ariya) degrade at ~2.1% per year under tropical humidity.",
                            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText, lineHeight = 18.sp),
                        )
                    }
                }

                // 2. Duty & Policy
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                    border = BorderStroke(1.dp, MotormilaOutline),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Filled.Shield, contentDescription = null, tint = MotormilaGood)
                                Text("Duty & Import Concessions", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                            }
                            Text("02 • TARIFF", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = MotormilaGood))
                        }
                        Text(
                            text = "Customs duty on battery electric vehicles (BEVs) under 100kW motor capacity carries preferential rates over ICE equivalents. Zero luxury tax applies below statutory CIF thresholds. Confirm HS code customs gazette classification before clearing.",
                            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText, lineHeight = 18.sp),
                        )
                    }
                }

                // 3. Charging Fit
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                    border = BorderStroke(1.dp, MotormilaOutline),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Filled.Power, contentDescription = null, tint = MotormilaWarn)
                                Text("Home vs Public Charging Fit", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                            }
                            Text("03 • RANGE", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = MotormilaWarn))
                        }
                        Text(
                            text = "Overnight 7kW AC home charging delivers ~LKR 6/km running cost (off-peak tariff) versus LKR 28/km for petrol. Public DC fast charging covers Expressway E01/E02 corridors and Kandy/Galle inter-city corridors.",
                            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText, lineHeight = 18.sp),
                        )
                    }
                }
            }
        }

        // Sri Lanka Fast-Charging Network Status
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Filled.Bolt, contentDescription = null, tint = MotormilaPrimary)
                            Text(
                                text = "Sri Lanka Fast-Charging Network",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = MotormilaGood.copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, MotormilaGood.copy(alpha = 0.4f)),
                        ) {
                            Text(
                                text = "ONLINE • 48 HUBS",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                    color = MotormilaGood,
                                ),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            )
                        }
                    }

                    Text(
                        text = "Real-time coverage along Southern Expressway (E01: Welipenna, Kottawa), Central Expressway (E02: Mirigama), and Colombo-Kandy (A1) highway.",
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText, lineHeight = 18.sp),
                    )

                    // Connector Standards
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        listOf("CCS2 (50-120kW)", "CHAdeMO (50kW)", "Type 2 (22kW)").forEach { connector ->
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = MotormilaSurface,
                                border = BorderStroke(1.dp, MotormilaOutline),
                                modifier = Modifier.weight(1f),
                            ) {
                                Text(
                                    text = connector,
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MotormilaOnSurface,
                                    ),
                                    modifier = Modifier.padding(vertical = 6.dp, horizontal = 4.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                )
                            }
                        }
                    }

                    // Search Radius Filter
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "Locate chargers within radius",
                            style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(10, 25, 50, 100).forEach { km ->
                                FilterChip(
                                    selected = state.chargerRadiusKm == km,
                                    onClick = { viewModel.onEvent(InsightsUiEvent.ChargerRadiusChanged(km)) },
                                    label = { Text("${km}km") },
                                    modifier = Modifier.heightIn(min = 36.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                        selectedLabelColor = MotormilaPrimaryBright,
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        enabled = true,
                                        selected = state.chargerRadiusKm == km,
                                        borderColor = MotormilaOutline,
                                        selectedBorderColor = MotormilaPrimary,
                                    ),
                                )
                            }
                        }
                    }

                    // Active Chargers List
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val activeChargers = if (state.chargers.isNotEmpty()) {
                            state.chargers
                        } else {
                            listOf(
                                "Welipenna Service Area · Southern Expressway E01 · 60kW CCS2",
                                "Kottawa Interchange Hub · Makumbura MMC · 50kW Dual",
                                "Mirigama Rest Point · Central Expressway E02 · 120kW Ultra-Fast",
                                "Peradeniya Gateway · Kandy A1 Corridor · 50kW DC",
                            )
                        }

                        activeChargers.forEach { c ->
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = MotormilaSurface,
                                border = BorderStroke(1.dp, MotormilaOutline),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Icon(Icons.Filled.Bolt, contentDescription = null, tint = MotormilaGood, modifier = Modifier.size(16.dp))
                                    Text(
                                        text = c,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 12.sp,
                                            color = MotormilaOnSurface,
                                        ),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------- 3. Index Tab ----------

@Composable
private fun IndexTab(state: InsightsUiState) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "MOTOROMILA PRICE INDEX",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MotormilaSecondaryText,
                        ),
                    )
                    Spacer(Modifier.height(12.dp))
                    AreaChart(
                        state.index,
                        Modifier.fillMaxWidth().height(200.dp)
                            .semantics { contentDescription = "Price index area chart" },
                    )
                }
            }
        }
        item {
            SectionTitle("Month on month movement")
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                state.index.takeLast(6).forEach { p ->
                    val mom = p.momChangePct ?: 0.0
                    AssistChip(
                        onClick = {},
                        label = { Text("${p.period.takeLast(7)}: ${if (mom >= 0) "+" else ""}${formatPct(mom)}") },
                        modifier = Modifier.heightIn(min = 44.dp),
                    )
                }
            }
        }
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Index Methodology", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                    Text(
                        "Hedonic median of verified Sri Lanka listings, district-weighted and rebased monthly. " +
                            "Low-sample vehicle variants are flagged and isolated to prevent distortion.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MotormilaSecondaryText,
                    )
                }
            }
        }
    }
}

@Composable
private fun AreaChart(points: List<PriceIndexPoint>, modifier: Modifier = Modifier) {
    val line = MotormilaPrimary
    val fill = MotormilaPrimary.copy(alpha = 0.2f)
    Canvas(modifier) {
        if (points.size < 2) return@Canvas
        val vals = points.map { it.indexValue.toFloat() }
        val min = vals.minOrNull() ?: 0f
        val max = vals.maxOrNull() ?: 1f
        val span = (max - min).takeIf { it > 0 } ?: 1f
        fun x(i: Int) = size.width * i / (points.size - 1)
        fun y(v: Float) = size.height - ((v - min) / span) * size.height
        val path = Path().apply {
            moveTo(0f, y(vals.first()))
            vals.forEachIndexed { i, v -> lineTo(x(i), y(v)) }
            lineTo(size.width, size.height)
            lineTo(0f, size.height)
            close()
        }
        drawPath(path, fill)
        vals.forEachIndexed { i, v ->
            if (i > 0) drawLine(line, Offset(x(i - 1), y(vals[i - 1])), Offset(x(i), y(v)), strokeWidth = 4.5f)
        }
    }
}

// ---------- 4. Districts Tab ----------

@Composable
private fun DistrictsTab(state: InsightsUiState, onDrillDistrict: (String) -> Unit) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "District map placeholder" },
            ) {
                Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Filled.Map, contentDescription = null, tint = MotormilaPrimary, modifier = Modifier.size(32.dp))
                    Spacer(Modifier.height(8.dp))
                    Text("District Heat Map", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                    Text(
                        "District price velocity and inventory concentration across Sri Lanka.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MotormilaSecondaryText,
                    )
                }
            }
        }
        item { SectionTitle("Velocity (median days to sell)") }
        items(state.districts, key = { it.district }) { d: DistrictStat ->
            DistrictRow(d, onDrill = { onDrillDistrict(d.district) })
        }
    }
}

@Composable
private fun DistrictRow(d: DistrictStat, onDrill: () -> Unit) {
    val topLine = listOfNotNull(d.topMake, d.topModel)
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .joinToString(" · ")
    Card(
        onClick = onDrill,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
        border = BorderStroke(1.dp, MotormilaOutline),
        modifier = Modifier.fillMaxWidth()
            .semantics { contentDescription = "${d.district}, median ${formatLkr(d.medianPriceLkr)}, ${d.count} listings" },
    ) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp).heightIn(min = 48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(d.district, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                Text(
                    "${formatLkrCompact(d.medianPriceLkr)} median · ${d.count} listings",
                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                    color = MotormilaSecondaryText,
                )
                if (topLine.isNotEmpty()) {
                    Text(
                        "Top: $topLine",
                        style = MaterialTheme.typography.bodySmall,
                        color = MotormilaSecondaryText,
                    )
                }
            }
            IconButton(onClick = onDrill, modifier = Modifier.heightIn(min = 48.dp)) {
                Icon(Icons.Filled.ChevronRight, contentDescription = "Drill into ${d.district}")
            }
        }
    }
}

// ---------- 5. Pulse Tab ----------

@Composable
private fun PulseTab(state: InsightsUiState, onOpenPulseDetail: (String) -> Unit) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { SectionTitle("Market Signals Feed") }
        items(state.pulse, key = { it.id }) { s ->
            Card(
                onClick = { onOpenPulseDetail(s.id) },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth()
                    .semantics { contentDescription = "Signal ${s.title}" },
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    AssistChip(onClick = {}, label = { Text(s.tag) })
                    Text(s.title, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                    Text(s.body, style = MaterialTheme.typography.bodySmall, color = MotormilaSecondaryText)
                    Text(s.timeLabel, style = MaterialTheme.typography.labelSmall.copy(color = MotormilaPrimaryBright))
                }
            }
        }
        item { SectionTitle("Automotive Industry News") }
        items(state.news, key = { it.id }) { n ->
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(n.title, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                    Text("${n.source} · ${n.timeLabel}", style = MaterialTheme.typography.labelSmall, color = MotormilaSecondaryText)
                }
            }
        }
    }
}
