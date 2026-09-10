package lk.motormila.app.ui.calc

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import lk.motormila.app.R
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.domain.repository.CostLine
import lk.motormila.app.domain.repository.LandedCost
import lk.motormila.app.domain.repository.Tco
import lk.motormila.app.ui.components.BrandLogo
import lk.motormila.app.ui.components.BrandLogoSize
import lk.motormila.app.ui.components.OfflineBanner
import lk.motormila.app.ui.theme.MotormilaBg
import lk.motormila.app.ui.theme.MotormilaOnPrimary
import lk.motormila.app.ui.theme.MotormilaOnSurface
import lk.motormila.app.ui.theme.MotormilaOutline
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaSecondaryText
import lk.motormila.app.ui.theme.MotormilaSurface
import lk.motormila.app.ui.theme.MotormilaSurfaceHigh
import lk.motormila.app.ui.theme.MotormilaWarn
import lk.motormila.app.ui.theme.rememberHaptics

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalculatorScreen(
    onBack: () -> Unit,
    onUpgrade: () -> Unit,
    viewModel: CalculatorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    val reducedMotion = rememberReducedMotion()
    val haptics = rememberHaptics()
    val backCd = stringResource(R.string.calc_cd_back)

    LaunchedEffect(state.error) {
        val message = state.error
        if (message != null) {
            snacks.showSnackbar(message)
            viewModel.onEvent(CalculatorUiEvent.DismissError)
        }
    }

    Scaffold(
        containerColor = MotormilaBg,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BrandLogo(
                            size = BrandLogoSize.COMPACT,
                            showWordmark = false,
                            showTagline = false,
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.calc_title), fontWeight = FontWeight.Bold)
                    }
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            if (!reducedMotion) haptics.tick()
                            onBack()
                        },
                        modifier = Modifier.size(48.dp).semantics { contentDescription = backCd },
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = backCd)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MotormilaBg,
                    titleContentColor = MotormilaOnSurface,
                    navigationIconContentColor = MotormilaOnSurface,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            OfflineBanner(visible = state.offline)
            CalculatorTabs(
                selected = state.tab,
                unlocked = state.unlocked,
                onSelect = { tab ->
                    if (!reducedMotion) haptics.tick()
                    viewModel.onEvent(CalculatorUiEvent.TabSelected(tab))
                },
            )
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                item { CalculatorHero() }
                if (!state.unlocked) {
                    item {
                        ProUpsellChips(
                            onUpgrade = {
                                if (!reducedMotion) haptics.tick()
                                onUpgrade()
                            },
                        )
                    }
                }
                item {
                    when (state.tab) {
                        CalculatorTab.LANDED -> LandedPane(
                            state = state,
                            onForm = { viewModel.onEvent(CalculatorUiEvent.LandedFormChanged(it)) },
                            onCalculate = {
                                if (!reducedMotion) haptics.tick()
                                viewModel.onEvent(CalculatorUiEvent.CalculateLanded)
                            },
                        )
                        CalculatorTab.TCO -> if (state.unlocked) {
                            TcoPane(
                                state = state,
                                onForm = { viewModel.onEvent(CalculatorUiEvent.TcoFormChanged(it)) },
                                onCalculate = {
                                    if (!reducedMotion) haptics.tick()
                                    viewModel.onEvent(CalculatorUiEvent.CalculateTco)
                                },
                            )
                        } else {
                            TcoLockedCard(
                                onUpgrade = {
                                    if (!reducedMotion) haptics.tick()
                                    onUpgrade()
                                },
                            )
                        }
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CalculatorTabs(
    selected: CalculatorTab,
    unlocked: Boolean,
    onSelect: (CalculatorTab) -> Unit,
) {
    val tabs = listOf(
        CalculatorTab.LANDED to stringResource(R.string.calc_tab_landed),
        CalculatorTab.TCO to stringResource(R.string.calc_tab_tco),
    )
    val selectedIndex = tabs.indexOfFirst { it.first == selected }.coerceAtLeast(0)
    PrimaryTabRow(
        selectedTabIndex = selectedIndex,
        containerColor = MotormilaBg,
        contentColor = MotormilaOnSurface,
    ) {
        tabs.forEachIndexed { index, (tab, title) ->
            val locked = tab == CalculatorTab.TCO && !unlocked
            val cd = if (locked) stringResource(R.string.calc_cd_tab_locked, title) else title
            Tab(
                selected = selectedIndex == index,
                onClick = { onSelect(tab) },
                text = { Text(title) },
                icon = if (locked) {
                    {
                        Icon(
                            Icons.Filled.Lock,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                } else {
                    null
                },
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .semantics { contentDescription = cd },
            )
        }
    }
}

@Composable
private fun CalculatorHero() {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(top = 8.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(50),
            color = MotormilaSurfaceHigh,
            border = BorderStroke(1.dp, MotormilaOutline),
        ) {
            Text(
                text = "• ${stringResource(R.string.calc_eyebrow).uppercase()}",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = MotormilaPrimaryBright,
                ),
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
        Text(
            text = stringResource(R.string.calc_headline),
            style = MaterialTheme.typography.headlineLarge.copy(
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp,
                color = MotormilaOnSurface,
            ),
        )
        Text(
            text = stringResource(R.string.calc_description),
            style = MaterialTheme.typography.bodyMedium.copy(
                color = MotormilaSecondaryText,
                lineHeight = 20.sp,
            ),
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProUpsellChips(onUpgrade: () -> Unit) {
    val upgradeCd = stringResource(R.string.calc_cd_upgrade)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(R.string.calc_upsell_hint),
            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(
                R.string.calc_tab_lease,
                R.string.calc_tab_ownership,
                R.string.calc_tab_permits,
                R.string.calc_tab_depreciation,
            ).forEach { labelRes ->
                FilterChip(
                    selected = false,
                    onClick = onUpgrade,
                    label = { Text(stringResource(labelRes)) },
                    leadingIcon = {
                        Icon(
                            Icons.Filled.Lock,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                        )
                    },
                    modifier = Modifier
                        .heightIn(min = 48.dp)
                        .semantics { contentDescription = upgradeCd },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                        selectedLabelColor = MotormilaPrimaryBright,
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = false,
                        borderColor = MotormilaOutline,
                        selectedBorderColor = MotormilaPrimary,
                    ),
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LandedPane(
    state: CalculatorUiState,
    onForm: (LandedForm) -> Unit,
    onCalculate: () -> Unit,
) {
    val form = state.landedForm
    val calculateCd = stringResource(R.string.calc_cd_calculate_landed)
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
            border = BorderStroke(1.dp, MotormilaOutline),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        Icons.Filled.AccountBalanceWallet,
                        contentDescription = null,
                        tint = MotormilaPrimary,
                    )
                    Column {
                        Text(
                            stringResource(R.string.calc_import_config),
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        )
                        Text(
                            stringResource(R.string.calc_import_config_hint),
                            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                        )
                    }
                }
                CalcTextField(
                    label = stringResource(R.string.calc_cif_lkr),
                    value = form.cifLkr,
                    keyboardType = KeyboardType.Number,
                    onChange = { onForm(form.copy(cifLkr = it)) },
                )
                AmountPreview(form.cifLkr)
                CalcTextField(
                    label = stringResource(R.string.calc_engine_cc),
                    value = form.engineCc,
                    keyboardType = KeyboardType.Number,
                    onChange = { onForm(form.copy(engineCc = it)) },
                )
                if (CalculatorInputs.showHybridCliff(form)) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Filled.Warning,
                            contentDescription = null,
                            tint = MotormilaWarn,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            stringResource(R.string.calc_hybrid_cliff),
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = MotormilaWarn,
                                fontWeight = FontWeight.SemiBold,
                            ),
                        )
                    }
                }
                Text(
                    stringResource(R.string.calc_fuel_category),
                    style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CalculatorFuelType.entries.forEach { fuel ->
                        val label = fuelLabel(fuel)
                        val fuelCd = stringResource(R.string.calc_cd_fuel, label)
                        FilterChip(
                            selected = form.fuelType == fuel,
                            onClick = { onForm(form.copy(fuelType = fuel)) },
                            label = { Text(label) },
                            modifier = Modifier
                                .heightIn(min = 48.dp)
                                .semantics { contentDescription = fuelCd },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MotormilaPrimary.copy(alpha = 0.2f),
                                selectedLabelColor = MotormilaPrimaryBright,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = form.fuelType == fuel,
                                borderColor = MotormilaOutline,
                                selectedBorderColor = MotormilaPrimary,
                            ),
                        )
                    }
                }
                CalcTextField(
                    label = stringResource(R.string.calc_year_optional),
                    value = form.year,
                    keyboardType = KeyboardType.Number,
                    onChange = { onForm(form.copy(year = it)) },
                )
                Text(
                    stringResource(R.string.calc_fx_hint),
                    style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                )
                ValidationText(state.validation)
                Button(
                    onClick = onCalculate,
                    enabled = !state.calculatingLanded,
                    shape = RoundedCornerShape(22.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MotormilaPrimary,
                        contentColor = MotormilaOnPrimary,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .semantics { contentDescription = calculateCd },
                ) {
                    if (state.calculatingLanded) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            color = MotormilaOnPrimary,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.calc_calculating), fontWeight = FontWeight.SemiBold)
                    } else {
                        Text(stringResource(R.string.calc_calculate_landed), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        LandedResultCard(result = state.landed, calculating = state.calculatingLanded)
    }
}

@Composable
private fun TcoPane(
    state: CalculatorUiState,
    onForm: (TcoForm) -> Unit,
    onCalculate: () -> Unit,
) {
    val form = state.tcoForm
    val calculateCd = stringResource(R.string.calc_cd_calculate_tco)
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
            border = BorderStroke(1.dp, MotormilaOutline),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Icons.Filled.Speed, contentDescription = null, tint = MotormilaPrimary)
                    Column {
                        Text(
                            stringResource(R.string.calc_tco_assumptions),
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        )
                        Text(
                            stringResource(R.string.calc_tco_assumptions_hint),
                            style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                        )
                    }
                }
                CalcTextField(
                    label = stringResource(R.string.calc_purchase_price),
                    value = form.priceLkr,
                    keyboardType = KeyboardType.Number,
                    onChange = { onForm(form.copy(priceLkr = it)) },
                )
                AmountPreview(form.priceLkr)
                CalcTextField(
                    label = stringResource(R.string.calc_monthly_km),
                    value = form.monthlyKm,
                    keyboardType = KeyboardType.Number,
                    onChange = { onForm(form.copy(monthlyKm = it)) },
                )
                CalcTextField(
                    label = stringResource(R.string.calc_km_per_litre),
                    value = form.kmPerLitre,
                    keyboardType = KeyboardType.Decimal,
                    onChange = { onForm(form.copy(kmPerLitre = it)) },
                )
                CalcTextField(
                    label = stringResource(R.string.calc_years),
                    value = form.years,
                    keyboardType = KeyboardType.Number,
                    onChange = { onForm(form.copy(years = it)) },
                )
                ValidationText(state.validation)
                Button(
                    onClick = onCalculate,
                    enabled = !state.calculatingTco,
                    shape = RoundedCornerShape(22.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MotormilaPrimary,
                        contentColor = MotormilaOnPrimary,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .semantics { contentDescription = calculateCd },
                ) {
                    if (state.calculatingTco) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            color = MotormilaOnPrimary,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.calc_calculating), fontWeight = FontWeight.SemiBold)
                    } else {
                        Text(stringResource(R.string.calc_calculate_tco), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        TcoResultCard(result = state.tco, calculating = state.calculatingTco)
    }
}

@Composable
private fun TcoLockedCard(onUpgrade: () -> Unit) {
    val upgradeCd = stringResource(R.string.calc_cd_upgrade)
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = MotormilaPrimary.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MotormilaPrimary.copy(alpha = 0.35f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Filled.Lock, contentDescription = null, tint = MotormilaPrimaryBright)
                Text(
                    stringResource(R.string.calc_tco_locked_title),
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = MotormilaPrimaryBright,
                    ),
                )
            }
            Text(
                stringResource(R.string.calc_tco_locked_body),
                style = MaterialTheme.typography.bodySmall,
                color = MotormilaSecondaryText,
            )
            Button(
                onClick = onUpgrade,
                shape = RoundedCornerShape(22.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MotormilaPrimary,
                    contentColor = MotormilaOnPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .semantics { contentDescription = upgradeCd },
            ) {
                Text(stringResource(R.string.calc_upgrade), fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun LandedResultCard(result: LandedCost?, calculating: Boolean) {
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
        border = BorderStroke(1.dp, MotormilaOutline),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                stringResource(R.string.calc_breakdown),
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
            )
            Text(
                stringResource(R.string.calc_breakdown_hint),
                style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
            )
            when {
                calculating && result == null -> {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(color = MotormilaPrimary, modifier = Modifier.size(24.dp))
                    }
                }
                result == null -> {
                    Text(
                        stringResource(R.string.calc_empty_result),
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )
                }
                else -> {
                    CostLineRow(stringResource(R.string.calc_base_cif), result.cifLkr)
                    result.breakdown.forEach { line ->
                        if (line.amountLkr > 0) {
                            CostLineRow(costLineLabel(line), line.amountLkr)
                        }
                    }
                    Surface(
                        shape = RoundedCornerShape(28.dp),
                        color = MotormilaPrimary.copy(alpha = 0.08f),
                        border = BorderStroke(1.dp, MotormilaPrimary.copy(alpha = 0.25f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                stringResource(R.string.calc_est_landed).uppercase(),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp,
                                    color = MotormilaPrimaryBright,
                                ),
                            )
                            Text(
                                LkrFormat.full(result.totalLkr),
                                style = MaterialTheme.typography.headlineMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = MotormilaOnSurface,
                                ),
                            )
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    stringResource(R.string.calc_total_taxes),
                                    style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                                )
                                Text(
                                    "+${LkrFormat.full(result.dutyLkr + result.vatLkr + result.palLkr)}",
                                    style = MaterialTheme.typography.labelMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = MotormilaPrimaryBright,
                                    ),
                                )
                            }
                        }
                    }
                    Text(
                        stringResource(R.string.calc_indicative),
                        style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                    )
                }
            }
        }
    }
}

@Composable
private fun TcoResultCard(result: Tco?, calculating: Boolean) {
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh.copy(alpha = 0.85f)),
        border = BorderStroke(1.dp, MotormilaOutline),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                stringResource(R.string.calc_tco_breakdown),
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
            )
            Text(
                stringResource(R.string.calc_tco_breakdown_hint),
                style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
            )
            when {
                calculating && result == null -> {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(color = MotormilaPrimary, modifier = Modifier.size(24.dp))
                    }
                }
                result == null -> {
                    Text(
                        stringResource(R.string.calc_empty_result),
                        style = MaterialTheme.typography.bodySmall.copy(color = MotormilaSecondaryText),
                    )
                }
                else -> {
                    CostLineRow(stringResource(R.string.calc_tco_purchase), result.purchaseLkr)
                    CostLineRow(stringResource(R.string.calc_tco_fuel), result.fuelLkr)
                    CostLineRow(stringResource(R.string.calc_tco_service), result.serviceLkr)
                    Surface(
                        shape = RoundedCornerShape(28.dp),
                        color = MotormilaPrimary.copy(alpha = 0.08f),
                        border = BorderStroke(1.dp, MotormilaPrimary.copy(alpha = 0.25f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text(
                                stringResource(R.string.calc_tco_monthly).uppercase(),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp,
                                    color = MotormilaPrimaryBright,
                                ),
                            )
                            Text(
                                LkrFormat.full(result.monthlyLkr),
                                style = MaterialTheme.typography.headlineMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = MotormilaOnSurface,
                                ),
                            )
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    stringResource(R.string.calc_tco_total),
                                    style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                                )
                                Text(
                                    LkrFormat.full(result.totalLkr),
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = MotormilaPrimaryBright,
                                    ),
                                )
                            }
                        }
                    }
                    Text(
                        stringResource(R.string.calc_indicative),
                        style = MaterialTheme.typography.labelSmall.copy(color = MotormilaSecondaryText),
                    )
                }
            }
        }
    }
}

@Composable
private fun CostLineRow(label: String, amountLkr: Double) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium.copy(color = MotormilaSecondaryText))
        Text(
            LkrFormat.full(amountLkr),
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
            ),
        )
    }
}

@Composable
private fun costLineLabel(line: CostLine): String = when (line.label.lowercase()) {
    "cid" -> stringResource(R.string.calc_line_cid)
    "surcharge" -> stringResource(R.string.calc_line_surcharge)
    "excise" -> stringResource(R.string.calc_line_excise)
    "sscl (pal)", "sscl" -> stringResource(R.string.calc_line_sscl)
    "vat" -> stringResource(R.string.calc_line_vat)
    "luxury tax" -> stringResource(R.string.calc_line_luxury)
    else -> line.label
}

@Composable
private fun fuelLabel(fuel: CalculatorFuelType): String = when (fuel) {
    CalculatorFuelType.PETROL -> stringResource(R.string.calc_fuel_petrol)
    CalculatorFuelType.DIESEL -> stringResource(R.string.calc_fuel_diesel)
    CalculatorFuelType.HYBRID -> stringResource(R.string.calc_fuel_hybrid)
    CalculatorFuelType.ELECTRIC -> stringResource(R.string.calc_fuel_electric)
}

@Composable
private fun ValidationText(reason: CalculatorValidation?) {
    val message = validationMessage(reason) ?: return
    Text(
        text = message,
        style = MaterialTheme.typography.labelSmall.copy(
            color = MotormilaWarn,
            fontWeight = FontWeight.SemiBold,
        ),
    )
}

@Composable
private fun validationMessage(reason: CalculatorValidation?): String? {
    if (reason == null) return null
    return stringResource(
        when (reason) {
            CalculatorValidation.CIF_REQUIRED -> R.string.calc_error_cif
            CalculatorValidation.ENGINE_CC_REQUIRED -> R.string.calc_error_engine_cc
            CalculatorValidation.YEAR_INVALID -> R.string.calc_error_year
            CalculatorValidation.PRICE_REQUIRED -> R.string.calc_error_price
            CalculatorValidation.MONTHLY_KM_REQUIRED -> R.string.calc_error_monthly_km
            CalculatorValidation.KM_PER_LITRE_REQUIRED -> R.string.calc_error_kmpl
            CalculatorValidation.YEARS_INVALID -> R.string.calc_error_years
        },
    )
}

@Composable
private fun AmountPreview(raw: String) {
    val amount = CalculatorInputs.parsePositiveAmount(raw) ?: return
    Text(
        text = LkrFormat.full(amount),
        style = MaterialTheme.typography.labelSmall.copy(
            fontFamily = FontFamily.Monospace,
            color = MotormilaSecondaryText,
        ),
    )
}

@Composable
private fun CalcTextField(
    label: String,
    value: String,
    keyboardType: KeyboardType,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(22.dp),
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
