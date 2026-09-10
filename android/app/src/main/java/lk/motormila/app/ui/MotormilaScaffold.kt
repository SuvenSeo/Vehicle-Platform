package lk.motormila.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import lk.motormila.app.R
import lk.motormila.app.ui.chat.AIChatBottomSheet
import lk.motormila.app.ui.home.badgeFor
import lk.motormila.app.ui.theme.MotormilaGlassFill
import lk.motormila.app.ui.theme.MotormilaGlassFillStrong
import lk.motormila.app.ui.theme.MotormilaGood
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import lk.motormila.app.ui.theme.MotormilaSecondaryText
import lk.motormila.app.ui.theme.applePress
import lk.motormila.app.ui.theme.fluidSpring
import lk.motormila.app.ui.theme.liquidGlass

data class BottomNavItem(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val badgeKey: String? = null,
)

@Composable
fun motormilaNavItems(): List<BottomNavItem> = listOf(
    BottomNavItem("home", stringResource(R.string.nav_home), Icons.Filled.Home),
    BottomNavItem("search", stringResource(R.string.nav_search), Icons.Filled.Search),
    BottomNavItem("watchlist", stringResource(R.string.nav_watchlist), Icons.Filled.Favorite, badgeKey = "watchlist"),
    BottomNavItem("insights", stringResource(R.string.nav_insights), Icons.Filled.AutoAwesome),
    BottomNavItem("profile", stringResource(R.string.nav_profile), Icons.Filled.Person, badgeKey = "inbox"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MotormilaScaffold(
    selected: String,
    showBottomBar: Boolean = true,
    badges: Map<String, Int> = emptyMap(),
    onNavigate: (route: String) -> Unit,
    onScan: () -> Unit,
    onOpenListing: ((Int) -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit,
) {
    var showAIChat by rememberSaveable { mutableStateOf(false) }
    val dockShape = RoundedCornerShape(32.dp)

    Scaffold(
        containerColor = Color.Transparent,
        bottomBar = {
            if (showBottomBar) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(start = 12.dp, end = 12.dp, bottom = 10.dp),
                ) {
                    NavigationBar(
                        modifier = Modifier
                            .fillMaxWidth()
                            .liquidGlass(dockShape, fill = MotormilaGlassFill)
                            .clip(dockShape),
                        containerColor = Color.Transparent,
                        contentColor = Color.White,
                        tonalElevation = 0.dp,
                        windowInsets = WindowInsets(0, 0, 0, 0),
                    ) {
                        motormilaNavItems().forEach { item ->
                            val isSelected = selected == item.route
                            val count = item.badgeKey?.let { badgeFor(it, badges) }
                            val interaction = remember(item.route) { MutableInteractionSource() }

                            val iconScale by animateFloatAsState(
                                targetValue = if (isSelected) 1.12f else 1.0f,
                                animationSpec = fluidSpring(),
                                label = "nav-icon-scale",
                            )

                            NavigationBarItem(
                                selected = isSelected,
                                onClick = { onNavigate(item.route) },
                                interactionSource = interaction,
                                icon = {
                                    Box(
                                        modifier = Modifier.graphicsLayer {
                                            scaleX = iconScale
                                            scaleY = iconScale
                                        },
                                    ) {
                                        if (count != null && count > 0) {
                                            BadgedBox(
                                                badge = {
                                                    Badge(
                                                        containerColor = MotormilaGood,
                                                        contentColor = Color.Black,
                                                        modifier = Modifier.semantics {
                                                            contentDescription = "$count new"
                                                        },
                                                    ) {
                                                        Text(
                                                            text = if (count > 99) "99+" else count.toString(),
                                                            fontWeight = FontWeight.Bold,
                                                            fontSize = 10.sp,
                                                        )
                                                    }
                                                },
                                            ) {
                                                Icon(item.icon, contentDescription = null)
                                            }
                                        } else {
                                            Icon(item.icon, contentDescription = null)
                                        }
                                    }
                                },
                                label = {
                                    Text(
                                        text = item.label,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        fontSize = 11.sp,
                                    )
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = MotormilaPrimaryBright,
                                    selectedTextColor = MotormilaPrimaryBright,
                                    indicatorColor = Color(0x2E0A7AFF),
                                    unselectedIconColor = MotormilaSecondaryText,
                                    unselectedTextColor = MotormilaSecondaryText,
                                ),
                                modifier = Modifier
                                    .applePress(interaction, pressedScale = 0.94f)
                                    .semantics { contentDescription = item.label },
                            )
                        }
                    }
                }
            }
        },
        floatingActionButton = {
            if (showBottomBar) {
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    val aiInteraction = remember { MutableInteractionSource() }
                    FloatingActionButton(
                        onClick = { showAIChat = true },
                        containerColor = Color.Transparent,
                        contentColor = MotormilaPrimaryBright,
                        elevation = FloatingActionButtonDefaults.elevation(
                            defaultElevation = 0.dp,
                            pressedElevation = 0.dp,
                        ),
                        interactionSource = aiInteraction,
                        shape = CircleShape,
                        modifier = Modifier
                            .size(48.dp)
                            .applePress(aiInteraction, pressedScale = 0.92f)
                            .liquidGlass(
                                CircleShape,
                                fill = MotormilaGlassFillStrong,
                                border = Color(0xFF0A7AFF),
                            )
                            .semantics { contentDescription = "Open Motormila AI Intelligence Assistant" },
                    ) {
                        Icon(
                            imageVector = Icons.Filled.AutoAwesome,
                            contentDescription = "Motormila AI Assistant",
                            tint = MotormilaPrimaryBright,
                            modifier = Modifier.size(22.dp),
                        )
                    }

                    val scanInteraction = remember { MutableInteractionSource() }
                    FloatingActionButton(
                        onClick = onScan,
                        containerColor = MotormilaPrimary,
                        contentColor = Color.White,
                        elevation = FloatingActionButtonDefaults.elevation(
                            defaultElevation = 6.dp,
                            pressedElevation = 10.dp,
                        ),
                        interactionSource = scanInteraction,
                        shape = CircleShape,
                        modifier = Modifier
                            .size(56.dp)
                            .applePress(scanInteraction, pressedScale = 0.92f)
                            .semantics { contentDescription = "Scan number plate" },
                    ) {
                        Icon(
                            imageVector = Icons.Filled.CameraAlt,
                            contentDescription = "Scan number plate",
                            tint = Color.White,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                }
            }
        },
        content = content,
    )

    if (showAIChat) {
        AIChatBottomSheet(
            onDismissRequest = { showAIChat = false },
            onOpenListing = { listingId ->
                showAIChat = false
                onOpenListing?.invoke(listingId) ?: onNavigate("listing/$listingId")
            },
        )
    }
}
