package lk.motormila.app.ui.valuation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.ui.SectionTitle
import lk.motormila.app.ui.theme.MotormilaBad
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

private val calcTabs = listOf("Workbench", "Landed", "Lease", "TCO", "Bundle", "Permits", "Deprec.")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ValuationScreen(
    onOpenListing: (id: Int) -> Unit,
    viewModel: ValuationViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    var tab by remember { mutableIntStateOf(0) }

    LaunchedEffect(state.error, state.estimateError) {
        (state.error ?: state.estimateError)?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(ValuationUiEvent.DismissError)
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Valuation & calculators") }) },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            PrimaryTabRow(selectedTabIndex = tab) {
                calcTabs.forEachIndexed { i, t ->
                    Tab(
                        selected = tab == i,
                        onClick = { tab = i },
                        text = { Text(t) },
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
            }
            when (tab) {
                0 -> ValuationWorkbenchTab(state, viewModel, onOpenListing)
                1 -> LandedTab(state, viewModel)
                2 -> LeaseTab(state, viewModel)
                3 -> TcoTab(state, viewModel)
                4 -> BundleTab(state, viewModel)
                5 -> PermitsTab()
                else -> DeprecationTab(state, viewModel)
            }
        }
    }
}

// ---------- 1. Valuation Workbench (Multi-Step Appraisal Wizard) ----------

@Composable
private fun ValuationWorkbenchTab(
    state: ValuationUiState,
    viewModel: ValuationViewModel,
    onOpenListing: (Int) -> Unit,
) {
    var step by remember { mutableIntStateOf(1) }

    // When a result arrives, advance to Step 3
    LaunchedEffect(state.result) {
        if (state.result != null) {
            step = 3
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Hero Header Section
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Eyebrow pill
                Surface(
                    shape = RoundedCornerShape(50),
                    color = MotormilaSurfaceHigh,
                    border = BorderStroke(1.dp, MotormilaOutline),
                ) {
                    Text(
                        text = "• ⏱ VALUATION WORKBENCH",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MotormilaPrimaryBright,
                        ),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }

                // Headline with negative letter spacing
                Text(
                    text = "What's your car worth?",
                    style = MaterialTheme.typography.headlineLarge.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.5).sp,
                        color = MotormilaOnSurface,
                    ),
                )

                // Subtitle
                Text(
                    text = "District-aware fair value ranges, trend projection, and seller ask guidance from live Sri Lanka inventory.",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = MotormilaSecondaryText,
                        lineHeight = 20.sp,
                    ),
                )
            }
        }

        // Multi-step appraisal wizard indicator
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                AppraisalWizardStepIndicator(
                    currentStep = step,
                    onStepClick = { targetStep ->
                        if (targetStep == 1) {
                            step = 1
                        } else if (targetStep == 2) {
                            val f = state.form
                            if (f.make.isNotBlank() && f.model.isNotBlank()) {
                                step = 2
                            }
                        } else if (targetStep == 3 && state.result != null) {
                            step = 3
                        }
                    },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                )
            }
        }

        // Wizard Step Content
        when (step) {
            1 -> {
                item {
                    Step01VehicleProfile(
                        state = state,
                        viewModel = viewModel,
                        onNext = { step = 2 },
                    )
                }
            }
            2 -> {
                item {
                    Step02MileageCondition(
                        state = state,
                        viewModel = viewModel,
                        onBack = { step = 1 },
                        onEstimate = {
                            viewModel.onEvent(ValuationUiEvent.Estimate)
                            step = 3
                        },
                    )
                }
            }
            else -> {
                item {
                    Step03ValuationGuidance(
                        state = state,
                        viewModel = viewModel,
                        onModify = { step = 2 },
                        onReset = {
                            step = 1
                            viewModel.onEvent(
                                ValuationUiEvent.FormChanged(
                                    ValuationForm(
                                        make = "",
                                        model = "",
                                        year = "",
                                        condition = "Good",
                                        transmission = "Automatic",
                                        fuel = "Petrol",
                                        mileageKm = "",
                                        district = "Colombo",
                                    ),
                                ),
                            )
                        },
                        onOpenListing = onOpenListing,
                    )
                }
            }
        }
    }
}

@Composable
private fun AppraisalWizardStepIndicator(
    currentStep: Int,
    onStepClick: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val steps = listOf(
        1 to "Profile",
        2 to "Mileage & Cond.",
        3 to "Valuation",
    )
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        steps.forEachIndexed { index, (stepNum, title) ->
            val isActive = currentStep == stepNum
            val isCompleted = currentStep > stepNum
            val statusColor = when {
                isActive -> MotormilaPrimary
                isCompleted -> MotormilaGood
                else -> MotormilaSecondaryText.copy(alpha = 0.5f)
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onStepClick(stepNum) }
                    .padding(vertical = 4.dp, horizontal = 2.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(
                            if (isActive) MotormilaPrimary
                            else if (isCompleted) MotormilaGood.copy(alpha = 0.2f)
                            else MotormilaSurface,
                        )
                        .border(1.dp, statusColor, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isCompleted) {
                        Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = null,
                            tint = MotormilaGood,
                            modifier = Modifier.size(14.dp),
                        )
                    } else {
                        Text(
                            text = "0$stepNum",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                color = if (isActive) Color.White else MotormilaSecondaryText,
                            ),
                        )
                    }
                }
                Spacer(Modifier.width(6.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                        color = if (isActive) MotormilaOnSurface else MotormilaSecondaryText,
                        fontSize = 11.sp,
                    ),
                )
            }

            if (index < steps.size - 1) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 6.dp)
                        .height(1.dp)
                        .background(if (currentStep > index + 1) MotormilaGood else MotormilaOutline),
                )
            }
        }
    }
}

// ---------- STEP 01: Vehicle Profile ----------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Step01VehicleProfile(
    state: ValuationUiState,
    viewModel: ValuationViewModel,
    onNext: () -> Unit,
) {
    val f = state.form
    val popularMakes = listOf("Toyota", "Honda", "Nissan", "Suzuki", "Mitsubishi", "Hyundai")
    val popularModels = when (f.make.lowercase().trim()) {
        "toyota" -> listOf("Premio", "Axio", "Vitz", "Aqua", "Prius", "Corolla", "CHR", "Raize")
        "honda" -> listOf("Grace", "Vezel", "Fit", "Civic", "Insight", "CR-V")
        "suzuki" -> listOf("Alto", "Wagon R", "Swift", "Spacia", "Hustler")
        "nissan" -> listOf("Leaf", "Dayz", "X-Trail", "March", "Note e-Power")
        "mitsubishi" -> listOf("Montero", "Outlander", "Attrage", "Eclipse Cross")
        else -> listOf("Premio", "Grace", "Alto", "Wagon R", "Vezel", "Aqua")
    }
    val years = listOf("2024", "2022", "2020", "2018", "2015", "2012")

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
        border = BorderStroke(1.dp, MotormilaOutline),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Step header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Filled.DirectionsCar, contentDescription = null, tint = MotormilaPrimary)
                Column {
                    Text(
                        text = "STEP 01: Vehicle profile",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = MotormilaOnSurface,
                        ),
                    )
                    Text(
                        text = "Specify basic specifications to anchor market comps.",
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )
                }
            }

            // Make Field & Suggestions
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                GlassTextField(
                    label = "Make",
                    value = f.make,
                    onChange = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(make = it))) },
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    popularMakes.forEach { m ->
                        FilterChip(
                            selected = f.make.equals(m, ignoreCase = true),
                            onClick = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(make = m))) },
                            label = { Text(m, fontSize = 11.sp) },
                            modifier = Modifier.heightIn(min = 32.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                selectedLabelColor = MotormilaPrimaryBright,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = f.make.equals(m, ignoreCase = true),
                                borderColor = MotormilaOutline,
                                selectedBorderColor = MotormilaPrimary,
                            ),
                        )
                    }
                }
            }

            // Model Field & Suggestions
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                GlassTextField(
                    label = "Model",
                    value = f.model,
                    onChange = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(model = it))) },
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    popularModels.forEach { m ->
                        FilterChip(
                            selected = f.model.equals(m, ignoreCase = true),
                            onClick = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(model = m))) },
                            label = { Text(m, fontSize = 11.sp) },
                            modifier = Modifier.heightIn(min = 32.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                selectedLabelColor = MotormilaPrimaryBright,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = f.model.equals(m, ignoreCase = true),
                                borderColor = MotormilaOutline,
                                selectedBorderColor = MotormilaPrimary,
                            ),
                        )
                    }
                }
            }

            // Year Field & Suggestions
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                GlassTextField(
                    label = "Year",
                    value = f.year,
                    keyboardType = KeyboardType.Number,
                    onChange = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(year = it))) },
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    years.forEach { y ->
                        FilterChip(
                            selected = f.year == y,
                            onClick = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(year = y))) },
                            label = { Text(y, fontSize = 11.sp) },
                            modifier = Modifier.heightIn(min = 32.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                selectedLabelColor = MotormilaPrimaryBright,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = f.year == y,
                                borderColor = MotormilaOutline,
                                selectedBorderColor = MotormilaPrimary,
                            ),
                        )
                    }
                }
            }

            // Transmission Selector
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Transmission", style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Automatic", "Manual", "CVT", "Tiptronic").forEach { t ->
                        FilterChip(
                            selected = f.transmission.equals(t, ignoreCase = true),
                            onClick = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(transmission = t))) },
                            label = { Text(t, fontSize = 12.sp) },
                            modifier = Modifier.heightIn(min = 36.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                selectedLabelColor = MotormilaPrimaryBright,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = f.transmission.equals(t, ignoreCase = true),
                                borderColor = MotormilaOutline,
                                selectedBorderColor = MotormilaPrimary,
                            ),
                        )
                    }
                }
            }

            // Fuel Selector
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Fuel type", style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Petrol", "Diesel", "Hybrid", "Electric", "Plug-in Hybrid").forEach { fuel ->
                        FilterChip(
                            selected = f.fuel.equals(fuel, ignoreCase = true),
                            onClick = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(fuel = fuel))) },
                            label = { Text(fuel, fontSize = 12.sp) },
                            modifier = Modifier.heightIn(min = 36.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                selectedLabelColor = MotormilaPrimaryBright,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = f.fuel.equals(fuel, ignoreCase = true),
                                borderColor = MotormilaOutline,
                                selectedBorderColor = MotormilaPrimary,
                            ),
                        )
                    }
                }
            }

            // District Selector
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Target district", style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Colombo", "Gampaha", "Kandy", "Kurunegala", "Kalutara", "Galle").forEach { d ->
                        FilterChip(
                            selected = f.district.equals(d, ignoreCase = true),
                            onClick = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(district = d))) },
                            label = { Text(d, fontSize = 12.sp) },
                            modifier = Modifier.heightIn(min = 36.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                selectedLabelColor = MotormilaPrimaryBright,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = f.district.equals(d, ignoreCase = true),
                                borderColor = MotormilaOutline,
                                selectedBorderColor = MotormilaPrimary,
                            ),
                        )
                    }
                }
            }

            Spacer(Modifier.height(4.dp))

            // Step 1 Next Button
            val isReady = f.make.isNotBlank() && f.model.isNotBlank() && f.year.isNotBlank()
            Button(
                onClick = onNext,
                enabled = isReady,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MotormilaPrimary,
                    contentColor = MotormilaOnPrimary,
                ),
            ) {
                Text("Continue to Mileage & Condition", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.width(8.dp))
                Icon(Icons.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
            }
            if (!isReady) {
                Text(
                    text = "Please enter make, model, and year to continue.",
                    style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                )
            }
        }
    }
}

// ---------- STEP 02: Mileage & Condition ----------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Step02MileageCondition(
    state: ValuationUiState,
    viewModel: ValuationViewModel,
    onBack: () -> Unit,
    onEstimate: () -> Unit,
) {
    val f = state.form
    val mileagePresets = listOf("20,000", "45,000", "70,000", "100,000", "140,000")

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
        border = BorderStroke(1.dp, MotormilaOutline),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Step header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Filled.Speed, contentDescription = null, tint = MotormilaPrimary)
                Column {
                    Text(
                        text = "STEP 02: Mileage & Condition",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = MotormilaOnSurface,
                        ),
                    )
                    Text(
                        text = "Calibrate odometer degradation and physical vehicle grade.",
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )
                }
            }

            // Summary of vehicle selected
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MotormilaSurface,
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            text = "${f.year} ${f.make} ${f.model}".trim().ifBlank { "Vehicle" },
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = MotormilaOnSurface,
                            ),
                        )
                        Text(
                            text = "${f.transmission} · ${f.fuel} · ${f.district}",
                            style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                        )
                    }
                    AssistChip(
                        onClick = onBack,
                        label = { Text("Edit profile") },
                    )
                }
            }

            // Odometer Input
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                GlassTextField(
                    label = "Odometer reading (km)",
                    value = f.mileageKm,
                    keyboardType = KeyboardType.Number,
                    onChange = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(mileageKm = it))) },
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    mileagePresets.forEach { km ->
                        FilterChip(
                            selected = f.mileageKm == km.replace(",", ""),
                            onClick = {
                                viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(mileageKm = km.replace(",", ""))))
                            },
                            label = { Text("$km km", fontSize = 11.sp) },
                            modifier = Modifier.heightIn(min = 32.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                selectedLabelColor = MotormilaPrimaryBright,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = f.mileageKm == km.replace(",", ""),
                                borderColor = MotormilaOutline,
                                selectedBorderColor = MotormilaPrimary,
                            ),
                        )
                    }
                }
            }

            // Condition Selector: Excellent, Good, Fair
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Condition grade",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = MotormilaSecondaryText,
                    ),
                )

                val conditions = listOf(
                    Triple(
                        "Excellent",
                        "Pristine / Like-New",
                        "Complete agent/dealer records, flawless exterior/interior, accident-free, top mechanical order.",
                    ),
                    Triple(
                        "Good",
                        "Well Maintained Daily",
                        "Routine service history, minor normal cosmetic wear, sound powertrain, dependable condition.",
                    ),
                    Triple(
                        "Fair",
                        "Wear & Tear / High Mileage",
                        "Noticeable body scratches, interior wear, due for suspension/tyre maintenance.",
                    ),
                )

                conditions.forEach { (condKey, condLabel, condDesc) ->
                    val isSelected = f.condition.equals(condKey, ignoreCase = true)
                    Card(
                        onClick = { viewModel.onEvent(ValuationUiEvent.FormChanged(f.copy(condition = condKey))) },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSelected) MotormilaPrimary.copy(alpha = 0.12f) else MotormilaSurface,
                        ),
                        border = BorderStroke(
                            1.dp,
                            if (isSelected) MotormilaPrimary else MotormilaOutline,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(CircleShape)
                                    .background(if (isSelected) MotormilaPrimary else Color.Transparent)
                                    .border(1.5.dp, if (isSelected) MotormilaPrimary else MotormilaSecondaryText, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (isSelected) {
                                    Icon(
                                        Icons.Filled.Check,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(12.dp),
                                    )
                                }
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    Text(
                                        text = condKey,
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected) MotormilaPrimaryBright else MotormilaOnSurface,
                                        ),
                                    )
                                    Text(
                                        text = "• $condLabel",
                                        style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                                    )
                                }
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    text = condDesc,
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = MotormilaSecondaryText,
                                        fontSize = 11.sp,
                                        lineHeight = 16.sp,
                                    ),
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(4.dp))

            // Action row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedButton(
                    onClick = onBack,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, MotormilaOutline),
                    modifier = Modifier
                        .weight(0.8f)
                        .heightIn(min = 48.dp),
                ) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Back")
                }

                Button(
                    onClick = onEstimate,
                    enabled = f.mileageKm.isNotBlank() && !state.estimating,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MotormilaPrimary,
                        contentColor = MotormilaOnPrimary,
                    ),
                    modifier = Modifier
                        .weight(1.2f)
                        .heightIn(min = 48.dp),
                ) {
                    if (state.estimating) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            color = Color.White,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("Appraising...")
                    } else {
                        Text("Calculate Valuation", fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.width(6.dp))
                        Icon(Icons.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
    }
}

// ---------- STEP 03: Valuation & Guidance ----------

@Composable
private fun Step03ValuationGuidance(
    state: ValuationUiState,
    viewModel: ValuationViewModel,
    onModify: () -> Unit,
    onReset: () -> Unit,
    onOpenListing: (Int) -> Unit,
) {
    val r = state.result
    val f = state.form
    val clipboard = LocalClipboardManager.current
    var copiedWhatsApp by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Step banner
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column {
                Text(
                    text = "STEP 03: Valuation & Guidance",
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp,
                        color = MotormilaPrimaryBright,
                    ),
                )
                Text(
                    text = "FMV calculation, range confidence, negotiation angle, and seller ask targets.",
                    style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                )
            }
            AssistChip(
                onClick = onModify,
                label = { Text("Edit inputs") },
            )
        }

        // When estimating / loading
        if (state.estimating) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    CircularProgressIndicator(color = MotormilaPrimary)
                    Text(
                        text = "Calibrating live Sri Lanka inventory...",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    )
                    Text(
                        text = "Synthesizing district asking prices, mileage adjustments, and hedonic regression curves.",
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )
                }
            }
        } else if (r != null) {
            // 1. Fair Market Value Hero Card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics {
                        contentDescription = "Valuation ${formatLkr(r.medianLkr)}, confidence ${r.confidence}"
                    },
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "FAIR MARKET VALUE ESTIMATE",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                color = MotormilaSecondaryText,
                            ),
                        )
                        val verdictColor = when (r.verdict.lowercase()) {
                            "great_deal" -> MotormilaGood
                            "fair", "fair_deal" -> MotormilaWarn
                            else -> MotormilaBad
                        }
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = verdictColor.copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, verdictColor.copy(alpha = 0.4f)),
                        ) {
                            Text(
                                text = r.verdictLabel.ifBlank { r.verdict.replace("_", " ").uppercase() },
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                    color = verdictColor,
                                ),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            )
                        }
                    }

                    Text(
                        text = r.vehicleLabel.ifBlank { "${f.year} ${f.make} ${f.model}" },
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    )

                    // Large Monospace Price
                    Text(
                        text = formatLkr(r.medianLkr),
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 32.sp,
                            color = MotormilaOnSurface,
                        ),
                    )

                    Text(
                        text = "Estimated median based on ${r.comparableCount} comparable listings in Sri Lanka.",
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )
                }
            }

            // 2. FMV Range Bar Card
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
                    Text(
                        text = "FMV RANGE & CONFIDENCE INTERVAL",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MotormilaSecondaryText,
                        ),
                    )

                    // Low / Median / High values
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column {
                            Text("LOW RANGE", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText))
                            Text(
                                text = formatLkr(r.lowLkr),
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = MotormilaOnSurface,
                                ),
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("FAIR MEDIAN", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaPrimaryBright, fontWeight = FontWeight.Bold))
                            Text(
                                text = formatLkr(r.medianLkr),
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = MotormilaPrimaryBright,
                                ),
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("HIGH RANGE", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText))
                            Text(
                                text = formatLkr(r.highLkr),
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = MotormilaOnSurface,
                                ),
                            )
                        }
                    }

                    // Graphical Range Bar
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(10.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(MotormilaSurface)
                            .border(1.dp, MotormilaOutline, RoundedCornerShape(5.dp)),
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.horizontalGradient(
                                        colors = listOf(
                                            MotormilaPrimary.copy(alpha = 0.45f),
                                            MotormilaPrimary,
                                            MotormilaPrimaryBright,
                                        ),
                                    ),
                                ),
                        )
                    }

                    // Confidence rating
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Confidence: ${r.confidence.uppercase()}",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = MotormilaPrimaryBright,
                            ),
                        )
                        Text(
                            text = "${r.comparableCount} verified comparables",
                            style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                        )
                    }
                }
            }

            // 3. Strategic Negotiation Angle
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
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(Icons.Filled.TrendingDown, contentDescription = null, tint = MotormilaGood)
                        Text(
                            text = "Strategic Negotiation Angle",
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = MotormilaOnSurface,
                            ),
                        )
                    }

                    Text(
                        text = "In Sri Lanka's automotive market, asking prices settle 5%–15% under listed ask. Anchor negotiations around verified local comps.",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = MotormilaSecondaryText,
                            lineHeight = 18.sp,
                        ),
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MotormilaSurface),
                            border = BorderStroke(1.dp, MotormilaOutline),
                            modifier = Modifier.weight(1f),
                        ) {
                            Column(Modifier.padding(10.dp)) {
                                Text(
                                    text = "OPENING BID",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText),
                                )
                                Text(
                                    text = formatLkr((r.medianLkr * 0.90).toLong().toDouble()),
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = MotormilaGood,
                                    ),
                                )
                                Text(
                                    text = "-10% under median",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText),
                                )
                            }
                        }

                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MotormilaSurface),
                            border = BorderStroke(1.dp, MotormilaOutline),
                            modifier = Modifier.weight(1f),
                        ) {
                            Column(Modifier.padding(10.dp)) {
                                Text(
                                    text = "TARGET CLOSE",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText),
                                )
                                Text(
                                    text = formatLkr((r.medianLkr * 0.95).toLong().toDouble()),
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = MotormilaOnSurface,
                                    ),
                                )
                                Text(
                                    text = "-5% fair settlement",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText),
                                )
                            }
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "• Baseline: Comparable asking median in ${f.district} is ${formatLkr(r.medianLkr)}",
                            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText, fontSize = 11.sp),
                        )
                        Text(
                            text = "• Condition note: ${f.condition} grade vehicle with ${f.mileageKm.ifBlank { "50,000" }} km",
                            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText, fontSize = 11.sp),
                        )
                        Text(
                            text = "• Leverage immediate pay / bank draft for additional 2%–4% settlement concession.",
                            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText, fontSize = 11.sp),
                        )
                    }
                }
            }

            // 4. Private Seller Fair Ask Guidance
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
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(Icons.Filled.Verified, contentDescription = null, tint = MotormilaPrimary)
                        Text(
                            text = "Private Seller Fair Ask Guidance",
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = MotormilaOnSurface,
                            ),
                        )
                    }

                    Text(
                        text = "Calibrated asking price strategy to sell promptly without leaving cash on the table.",
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MotormilaSurface),
                            border = BorderStroke(1.dp, MotormilaOutline),
                            modifier = Modifier.weight(1f),
                        ) {
                            Column(Modifier.padding(10.dp)) {
                                Text("SUGGESTED ASK", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText))
                                Text(
                                    text = formatLkr((r.medianLkr * 1.04).toLong().toDouble()),
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = MotormilaPrimaryBright,
                                    ),
                                )
                                Text("+4% negotiation cushion", style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, color = MotormilaSecondaryText))
                            }
                        }

                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MotormilaSurface),
                            border = BorderStroke(1.dp, MotormilaOutline),
                            modifier = Modifier.weight(1f),
                        ) {
                            Column(Modifier.padding(10.dp)) {
                                Text("WALKAWAY FLOOR", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText))
                                Text(
                                    text = formatLkr((r.medianLkr * 0.92).toLong().toDouble()),
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = MotormilaWarn,
                                    ),
                                )
                                Text("-8% firm bottom", style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, color = MotormilaSecondaryText))
                            }
                        }

                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MotormilaSurface),
                            border = BorderStroke(1.dp, MotormilaOutline),
                            modifier = Modifier.weight(1f),
                        ) {
                            Column(Modifier.padding(10.dp)) {
                                Text("DEALER OFFER", style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, color = MotormilaSecondaryText))
                                Text(
                                    text = formatLkr((r.medianLkr * 0.85).toLong().toDouble()),
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = MotormilaSecondaryText,
                                    ),
                                )
                                Text("Instant trade-in", style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, color = MotormilaSecondaryText))
                            }
                        }
                    }

                    // Copy WhatsApp Pitch
                    Button(
                        onClick = {
                            val text = "🚗 *Motormila Sri Lanka — Valuation Summary*\n" +
                                "• Vehicle: ${f.year} ${f.make} ${f.model}\n" +
                                "• Condition: ${f.condition} | Mileage: ${f.mileageKm} km\n" +
                                "• District: ${f.district}\n" +
                                "• Fair Market Median: ${formatLkr(r.medianLkr)}\n" +
                                "• Suggested Listing Ask: ${formatLkr((r.medianLkr * 1.04).toLong().toDouble())}\n" +
                                "• Walkaway Floor: ${formatLkr((r.medianLkr * 0.92).toLong().toDouble())}\n" +
                                "• Dealer Trade-in Band: ${formatLkr((r.medianLkr * 0.85).toLong().toDouble())} – ${formatLkr((r.medianLkr * 0.91).toLong().toDouble())}\n" +
                                "Generated via Motormila Live Market Intelligence."
                            clipboard.setText(AnnotatedString(text))
                            copiedWhatsApp = true
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MotormilaGood.copy(alpha = 0.15f),
                            contentColor = MotormilaGoodText,
                        ),
                        border = BorderStroke(1.dp, MotormilaGood.copy(alpha = 0.35f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 44.dp),
                    ) {
                        Icon(
                            if (copiedWhatsApp) Icons.Filled.Check else Icons.Filled.ContentCopy,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = if (copiedWhatsApp) "Copied WhatsApp Report!" else "Copy WhatsApp Negotiation Summary",
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }

            // 5. Comparables
            if (r.comparables.isNotEmpty()) {
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
                        Text(
                            text = "LIVE MARKET COMPARABLES",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                color = MotormilaSecondaryText,
                            ),
                        )

                        r.comparables.take(5).forEach { c ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 48.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        text = c.title.ifBlank { "Comparable vehicle" },
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                    )
                                    Text(
                                        text = "${c.district ?: "Sri Lanka"} · ${formatLkr(c.priceLkr)}",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            color = MotormilaPrimaryBright,
                                            fontFamily = FontFamily.Monospace,
                                        ),
                                    )
                                }
                                AssistChip(
                                    onClick = { onOpenListing(c.id) },
                                    label = { Text("View") },
                                )
                            }
                        }
                    }
                }
            }

            // Reset & Appraise another
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedButton(
                    onClick = onModify,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, MotormilaOutline),
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp),
                ) {
                    Text("Adjust Inputs")
                }

                Button(
                    onClick = onReset,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MotormilaPrimary,
                        contentColor = MotormilaOnPrimary,
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp),
                ) {
                    Text("Appraise Another")
                }
            }
        } else {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = "No valuation active",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    )
                    Text(
                        text = "Complete vehicle specifications in Step 1 and Step 2 to generate an appraisal.",
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )
                    Button(
                        onClick = onReset,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MotormilaPrimary,
                            contentColor = MotormilaOnPrimary,
                        ),
                    ) {
                        Text("Start Appraisal Wizard")
                    }
                }
            }
        }
    }
}

// ---------- Shared Glass TextField Component ----------

@Composable
private fun GlassTextField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
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

// ---------- Landed cost ----------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LandedTab(state: ValuationUiState, viewModel: ValuationViewModel) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            SectionTitle("Landed cost — CIF USD + auto FX macro")
            Text(
                "FX ${state.fxRate?.let { "%.1f LKR/USD (auto)".format(it) } ?: "loading…"}",
                style = MaterialTheme.typography.labelMedium.copy(color = MotormilaSecondaryText),
            )
            val i = state.landedInput
            GlassTextField("CIF (USD)", i.cifUsd, keyboardType = KeyboardType.Number) {
                viewModel.onEvent(ValuationUiEvent.LandedChanged(i.copy(cifUsd = it)))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassTextField("Engine (cc)", i.engineCc, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.LandedChanged(i.copy(engineCc = it)))
                }
                GlassTextField("Motor (kW, EV)", i.electricKw, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.LandedChanged(i.copy(electricKw = it)))
                }
            }
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Petrol", "Diesel", "Hybrid", "Electric").forEach { fuel ->
                    FilterChip(
                        selected = i.fuel == fuel,
                        onClick = { viewModel.onEvent(ValuationUiEvent.LandedChanged(i.copy(fuel = fuel))) },
                        label = { Text(fuel) },
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
            }
            ToggleRow("Include clearing (~LKR 450,000)", i.includeClearing) {
                viewModel.onEvent(ValuationUiEvent.LandedChanged(i.copy(includeClearing = it)))
            }
            ToggleRow("Include registration (~LKR 250,000)", i.includeRegistration) {
                viewModel.onEvent(ValuationUiEvent.LandedChanged(i.copy(includeRegistration = it)))
            }
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { viewModel.onEvent(ValuationUiEvent.CalcLanded) },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MotormilaPrimary, contentColor = MotormilaOnPrimary),
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            ) {
                Text("Calculate landed cost", fontWeight = FontWeight.SemiBold)
            }
        }
        state.landed?.let { l ->
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                    border = BorderStroke(1.dp, MotormilaOutline),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Breakdown("CIF", l.cifLkr)
                        Breakdown("Excise", l.exciseLkr)
                        Breakdown("VAT 18%", l.vatLkr)
                        Breakdown("Clearing", l.clearingLkr)
                        Breakdown("Registration", l.registrationLkr)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Total ${formatLkr(l.totalLkr.toLong())}",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace),
                        )
                        Text(
                            "FX used: %.1f · countdown: verify against customs notice before payment.".format(l.fxUsed),
                            style = MaterialTheme.typography.labelSmall,
                            color = MotormilaSecondaryText,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, onCheckedChange = onChange, modifier = Modifier.semantics { contentDescription = label })
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun Breakdown(label: String, value: Double) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium.copy(color = MotormilaSecondaryText))
        Text(formatLkr(value.toLong()), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace))
    }
}

// ---------- Lease / TCO / Bundle / Permits / Depreciation ----------

@Composable
private fun LeaseTab(state: ValuationUiState, viewModel: ValuationViewModel) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            SectionTitle("Lease — monthly with LTV guard")
            val i = state.leaseInput
            GlassTextField("Price (LKR)", i.priceLkr, keyboardType = KeyboardType.Number) {
                viewModel.onEvent(ValuationUiEvent.LeaseChanged(i.copy(priceLkr = it)))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassTextField("Down %", i.downPct, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.LeaseChanged(i.copy(downPct = it)))
                }
                GlassTextField("Rate % p.a.", i.ratePct, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.LeaseChanged(i.copy(ratePct = it)))
                }
                GlassTextField("Years", i.years, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.LeaseChanged(i.copy(years = it)))
                }
            }
            Spacer(Modifier.height(8.dp))
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "Monthly ${formatLkr(viewModel.leaseMonthly().toLong())}",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace),
                    )
                    if (viewModel.leaseLtvBreached()) {
                        Text(
                            "LTV guard: down payment under 20% — most lenders cap at 80% LTV. Raise the deposit.",
                            color = MotormilaBad,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TcoTab(state: ValuationUiState, viewModel: ValuationViewModel) {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            SectionTitle("Total cost of ownership — monthly")
            val i = state.tcoInput
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassTextField("km/day", i.kmPerDay, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.TcoChanged(i.copy(kmPerDay = it)))
                }
                GlassTextField("km/L", i.kmPerLitre, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.TcoChanged(i.copy(kmPerLitre = it)))
                }
                GlassTextField("Fuel LKR/L", i.fuelPriceLkr, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.TcoChanged(i.copy(fuelPriceLkr = it)))
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassTextField("Service/yr", i.servicePerYearLkr, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.TcoChanged(i.copy(servicePerYearLkr = it)))
                }
                GlassTextField("Insurance/yr", i.insurancePerYearLkr, Modifier.weight(1f), keyboardType = KeyboardType.Number) {
                    viewModel.onEvent(ValuationUiEvent.TcoChanged(i.copy(insurancePerYearLkr = it)))
                }
            }
            Spacer(Modifier.height(8.dp))
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "Monthly ${formatLkr(viewModel.tcoMonthly().toLong())}",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace),
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BundleTab(state: ValuationUiState, viewModel: ValuationViewModel) {
    val classes = listOf("Motorcycle", "Car <1000cc", "Car 1000–1500cc", "Car >1500cc", "SUV / Dual purpose")
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            SectionTitle("Ownership bundle — statutory total")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                classes.forEach { c ->
                    FilterChip(
                        selected = state.bundleClass == c,
                        onClick = { viewModel.onEvent(ValuationUiEvent.BundleChanged(c, state.bundleFuel)) },
                        label = { Text(c) },
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Petrol", "Diesel").forEach { f ->
                    FilterChip(
                        selected = state.bundleFuel == f,
                        onClick = { viewModel.onEvent(ValuationUiEvent.BundleChanged(state.bundleClass, f)) },
                        label = { Text(f) },
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                border = BorderStroke(1.dp, MotormilaOutline),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "Statutory total ${formatLkr(viewModel.ownershipTotal().toLong())}",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace),
                    )
                    Text(
                        "Revenue licence + emission + registration renewal (indicative).",
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )
                }
            }
        }
    }
}

@Composable
private fun PermitsTab() {
    val rows = listOf(
        "Revenue licence" to "Annual, by engine capacity",
        "Emission test" to "Annual for most classes",
        "Registration renewal" to "On transfer / expiry",
        "Highway vignette" to "If applicable",
    )
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { SectionTitle("Permits & renewals") }
        rows.forEach { (name, cadence) ->
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                    border = BorderStroke(1.dp, MotormilaOutline),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp).heightIn(min = 48.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(name, style = MaterialTheme.typography.bodyLarge.copy(color = MotormilaOnSurface))
                        AssistChip(onClick = {}, label = { Text(cadence) })
                    }
                }
            }
        }
    }
}

@Composable
private fun DeprecationTab(state: ValuationUiState, viewModel: ValuationViewModel) {
    val base = state.result?.medianLkr ?: (state.leaseInput.priceLkr.replace(",", "").toDoubleOrNull() ?: 8_000_000.0)
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { SectionTitle("Depreciation — written-down value") }
        viewModel.depreciationSchedule(base).forEach { (label, value) ->
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
                    border = BorderStroke(1.dp, MotormilaOutline),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp).heightIn(min = 48.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(label, style = MaterialTheme.typography.bodyLarge.copy(color = MotormilaOnSurface))
                        Text(
                            formatLkr(value.toLong()),
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace),
                        )
                    }
                }
            }
        }
    }
}
