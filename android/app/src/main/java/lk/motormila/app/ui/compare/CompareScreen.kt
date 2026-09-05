package lk.motormila.app.ui.compare

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import java.util.Locale
import lk.motormila.app.core.format.LkrFormat
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.ui.ErrorRetry
import lk.motormila.app.core.ui.SkeletonList
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.ui.components.DealBadge
import lk.motormila.app.ui.theme.MotormilaBg
import lk.motormila.app.ui.theme.MotormilaOutline
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaSecondaryText
import lk.motormila.app.ui.theme.MotormilaSurface
import lk.motormila.app.ui.theme.MotormilaSurfaceHigh
import lk.motormila.app.ui.theme.MotormilaSurfaceHighest

private val BestCellHighlight = Color(0x2E0A7AFF)
private val BestCellBorder = Color(0x550A7AFF)

/**
 * Compare up to 4 listings side by side.
 * - Eyebrow pill: • ⚖️ COMPARE
 * - Headline: "Vehicle Comparison"
 * - Subtitle: "Side-by-side specs, pricing, and deal scores for up to 4 vehicles."
 * - Multi-vehicle comparison matrix (Price, FMV, Deal Score badge, Mileage, Year, District).
 * - Empty state matching web: Scales icon in electric blue halo,
 *   "No vehicles selected. Select vehicles from the Dashboard or Search to compare."
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompareScreen(
    ids: List<Int>,
    onOpenDetail: (id: Int) -> Unit,
    onAddListing: () -> Unit,
    onBrowse: () -> Unit,
    viewModel: CompareViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(CompareUiEvent.DismissError)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (state.items.isEmpty()) "Vehicle Comparison" else "Vehicle Comparison (${state.items.size}/4)",
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBrowse) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
                actions = {
                    if (state.items.size < 4) {
                        IconButton(
                            onClick = onAddListing,
                            modifier = Modifier.semantics { contentDescription = "Add listing to compare" },
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Add,
                                contentDescription = "Add listing",
                                tint = MotormilaPrimaryBright,
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MotormilaBg,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = MotormilaPrimaryBright,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snacks) },
        containerColor = MotormilaBg,
    ) { padding ->
        when {
            state.isLoading -> {
                Box(Modifier.fillMaxSize().padding(padding)) { SkeletonList() }
            }
            state.error != null && state.items.isEmpty() -> {
                Box(Modifier.fillMaxSize().padding(padding)) {
                    ErrorRetry(
                        message = state.error ?: "Error loading comparison",
                        onRetry = { viewModel.onEvent(CompareUiEvent.Refresh) },
                    )
                }
            }
            state.items.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CompareEmptyState(onBrowse = onBrowse)
                }
            }
            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState()),
                ) {
                    // Eyebrow & Header section matching web platform
                    CompareHeaderSection()

                    // Multi-vehicle comparison matrix
                    CompareMatrixTable(
                        items = state.items,
                        onOpenDetail = onOpenDetail,
                        onRemove = { viewModel.onEvent(CompareUiEvent.Remove(it)) },
                        onAddListing = onAddListing,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 24.dp),
                    )
                }
            }
        }
    }
}

/** Header block with Eyebrow pill, Headline, and Subtitle. */
@Composable
private fun CompareHeaderSection(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        // Eyebrow pill: • ⚖️ COMPARE
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(Color(0x2E0A7AFF))
                .border(0.6.dp, Color(0x660A7AFF), RoundedCornerShape(999.dp))
                .padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = "• ⚖️ COMPARE",
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.sp,
                color = MotormilaPrimaryBright,
            )
        }

        Spacer(Modifier.height(8.dp))

        // Headline: Vehicle Comparison
        Text(
            text = "Vehicle Comparison",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            letterSpacing = (-0.5).sp,
        )

        Spacer(Modifier.height(4.dp))

        // Subtitle: Side-by-side specs, pricing, and deal scores for up to 4 vehicles.
        Text(
            text = "Side-by-side specs, pricing, and deal scores for up to 4 vehicles.",
            fontSize = 13.5.sp,
            color = MotormilaSecondaryText,
            lineHeight = 18.sp,
        )

        Spacer(Modifier.height(8.dp))
    }
}

/** Empty state matching web: Scales icon in electric blue halo. */
@Composable
private fun CompareEmptyState(
    onBrowse: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Scales icon in electric blue halo
        Box(
            modifier = Modifier
                .size(68.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0x2E0A7AFF))
                .border(1.2.dp, Color(0x663D94FF), RoundedCornerShape(20.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "⚖️",
                fontSize = 32.sp,
            )
        }

        Spacer(Modifier.height(18.dp))

        Text(
            text = "No vehicles selected",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = "No vehicles selected. Select vehicles from the Dashboard or Search to compare.",
            fontSize = 14.sp,
            color = MotormilaSecondaryText,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp,
            modifier = Modifier.padding(horizontal = 20.dp),
        )

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = onBrowse,
            colors = ButtonDefaults.buttonColors(
                containerColor = MotormilaPrimary,
                contentColor = Color.White,
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .heightIn(min = 48.dp)
                .semantics { contentDescription = "Browse listings" },
        ) {
            Icon(
                imageVector = Icons.Filled.Search,
                contentDescription = null,
                modifier = Modifier
                    .size(18.dp)
                    .padding(end = 4.dp),
            )
            Text(
                text = "Browse listings",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
        }
    }
}

/** Multi-vehicle comparison matrix with sticky row labels and horizontal scrolling columns. */
@Composable
private fun CompareMatrixTable(
    items: List<Listing>,
    onOpenDetail: (Int) -> Unit,
    onRemove: (Int) -> Unit,
    onAddListing: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scrollState = rememberScrollState()

    // Leaders calculation
    val bestPrice = items.mapNotNull { it.priceLkr }.minOrNull()
    val bestYear = items.mapNotNull { it.year }.maxOrNull()
    val bestMileage = items.mapNotNull { it.mileageKm }.filter { it > 0 }.minOrNull()

    Row(modifier = modifier) {
        // Sticky First Column: Row labels
        Column(
            modifier = Modifier
                .width(115.dp)
                .background(MotormilaBg),
        ) {
            // Spacer to align perfectly with the vehicle card header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .padding(start = 16.dp, bottom = 12.dp),
                contentAlignment = Alignment.BottomStart,
            ) {
                Text(
                    text = "SPECIFICATION",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.8.sp,
                    color = Color(0xFF6E6E73),
                )
            }

            // Metric labels (52dp height each)
            LabelCell("Price")
            LabelCell("FMV")
            LabelCell("Deal Score")
            LabelCell("Mileage")
            LabelCell("Year")
            LabelCell("District")
            LabelCell("Fuel")
            LabelCell("Gearbox")
            LabelCell("Condition")
        }

        // Horizontal Scrolling Vehicle Columns
        Row(
            modifier = Modifier
                .horizontalScroll(scrollState)
                .padding(end = 16.dp),
        ) {
            items.forEach { listing ->
                VehicleMatrixColumn(
                    listing = listing,
                    isBestPrice = listing.priceLkr != null && listing.priceLkr == bestPrice,
                    isBestYear = listing.year != null && listing.year == bestYear,
                    isBestMileage = listing.mileageKm != null && listing.mileageKm == bestMileage,
                    onOpenDetail = { onOpenDetail(listing.id) },
                    onRemove = { onRemove(listing.id) },
                )
            }

            // Slot to add another vehicle if < 4
            if (items.size < 4) {
                AddVehicleColumnSlot(
                    onAdd = onAddListing,
                    currentCount = items.size,
                )
            }
        }
    }
}

/** Individual vehicle column with header card and aligned spec cells. */
@Composable
private fun VehicleMatrixColumn(
    listing: Listing,
    isBestPrice: Boolean,
    isBestYear: Boolean,
    isBestMileage: Boolean,
    onOpenDetail: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .width(180.dp)
            .padding(end = 10.dp),
    ) {
        // Vehicle Header Card (height 180dp)
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .clickable { onOpenDetail() }
                .semantics { contentDescription = "Vehicle ${listing.displayName}" },
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MotormilaSurfaceHigh),
            border = androidx.compose.foundation.BorderStroke(1.dp, MotormilaOutline),
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Photo header
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(95.dp)
                        .background(MotormilaBg),
                ) {
                    if (!listing.heroImageUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = listing.heroImageUrl,
                            contentDescription = listing.displayName,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Filled.DirectionsCar,
                                contentDescription = null,
                                tint = MotormilaSecondaryText,
                                modifier = Modifier.size(32.dp),
                            )
                        }
                    }

                    // Remove button top right
                    IconButton(
                        onClick = onRemove,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(4.dp)
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(Color(0xCC09090B)),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Remove ${listing.displayName}",
                            tint = Color.White,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }

                // Details footer
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text(
                            text = listing.displayName,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = "${listing.year ?: "—"} · ${listing.district ?: "Sri Lanka"}",
                            fontSize = 11.sp,
                            color = MotormilaSecondaryText,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Open",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MotormilaPrimaryBright,
                        )
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = MotormilaPrimaryBright,
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(10.dp))

        // Multi-vehicle comparison matrix cells (matching 52dp height):
        // 1. Price
        ValueCell(
            text = formatLkr(listing.priceLkr),
            isBest = isBestPrice,
            isPrice = true,
            desc = "Price ${formatLkr(listing.priceLkr)}",
        )

        // 2. FMV
        val fmvText = listing.marketMedianLkr?.let { formatLkr(it) } ?: "—"
        val delta = listing.deltaVsMedianPct()
        val deltaText = if (delta != null) {
            " (${if (delta <= 0) "" else "+"}${String.format(Locale.US, "%.1f", delta)}%)"
        } else {
            ""
        }
        ValueCell(
            text = "$fmvText$deltaText",
            isBest = false,
            desc = "FMV $fmvText",
        )

        // 3. Deal Score badge
        BadgeCell {
            DealBadge(band = listing.dealBand(), score = listing.dealScore)
        }

        // 4. Mileage
        ValueCell(
            text = listing.mileageKm?.let { LkrFormat.km(it) } ?: "—",
            isBest = isBestMileage,
            desc = "Mileage ${listing.mileageKm ?: "—"}",
        )

        // 5. Year
        ValueCell(
            text = listing.year?.toString() ?: "—",
            isBest = isBestYear,
            desc = "Year ${listing.year ?: "—"}",
        )

        // 6. District
        ValueCell(
            text = listing.district ?: "—",
            isBest = false,
            desc = "District ${listing.district ?: "—"}",
        )

        // 7. Fuel
        ValueCell(
            text = listing.fuelType?.replaceFirstChar(Char::uppercase) ?: "—",
            isBest = false,
            desc = "Fuel",
        )

        // 8. Gearbox
        ValueCell(
            text = listing.transmission?.replaceFirstChar(Char::uppercase) ?: "—",
            isBest = false,
            desc = "Transmission",
        )

        // 9. Condition
        ValueCell(
            text = listing.condition?.replaceFirstChar(Char::uppercase) ?: "—",
            isBest = false,
            desc = "Condition",
        )
    }
}

/** Slot to add another vehicle when count < 4. */
@Composable
private fun AddVehicleColumnSlot(
    onAdd: () -> Unit,
    currentCount: Int,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .width(150.dp)
            .height(180.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(16.dp))
                .background(MotormilaSurface)
                .border(1.dp, Color(0x443D94FF), RoundedCornerShape(16.dp))
                .clickable { onAdd() }
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color(0x2E0A7AFF)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = "Add vehicle to compare",
                        tint = MotormilaPrimaryBright,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    text = "Add vehicle",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Text(
                    text = "Slot ${currentCount + 1}/4",
                    fontSize = 10.5.sp,
                    color = MotormilaSecondaryText,
                )
            }
        }
    }
}

/** Sticky row label cell (height 52dp). */
@Composable
private fun LabelCell(text: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = MotormilaSecondaryText,
        )
    }
}

/** Metric value cell with optional "best" leader highlight (height 52dp). */
@Composable
private fun ValueCell(
    text: String,
    isBest: Boolean,
    desc: String,
    isPrice: Boolean = false,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (isBest) BestCellHighlight else Color.Transparent)
            .border(
                width = if (isBest) 0.8.dp else 0.dp,
                color = if (isBest) BestCellBorder else Color.Transparent,
                shape = RoundedCornerShape(10.dp),
            )
            .padding(horizontal = 12.dp)
            .semantics { contentDescription = "$desc${if (isBest) ", leader" else ""}" },
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text = text,
            fontSize = if (isPrice) 13.5.sp else 13.sp,
            fontFamily = if (isPrice) FontFamily.Monospace else FontFamily.Default,
            fontWeight = if (isBest || isPrice) FontWeight.Bold else FontWeight.Normal,
            color = if (isBest) MotormilaPrimaryBright else Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** Badge cell for Deal Score and other pill-style badges (height 52dp). */
@Composable
private fun BadgeCell(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .padding(horizontal = 10.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        content()
    }
}
