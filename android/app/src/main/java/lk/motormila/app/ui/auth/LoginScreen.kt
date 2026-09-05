package lk.motormila.app.ui.auth

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import lk.motormila.app.ui.components.BrandLogo
import lk.motormila.app.ui.components.BrandLogoSize
import lk.motormila.app.ui.theme.MotormilaOutline
import lk.motormila.app.ui.theme.MotormilaPrimary
import lk.motormila.app.ui.theme.MotormilaPrimaryBright
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import kotlin.math.roundToInt
import lk.motormila.app.core.motion.rememberReducedMotion
import lk.motormila.app.core.ui.PrimaryAction

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLoggedIn: () -> Unit,
    onBiometricAuth: (onSuccess: () -> Unit, onError: (String) -> Unit) -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val biometricEnabled by viewModel.biometricEnabled.collectAsStateWithLifecycle()
    val snacks = remember { SnackbarHostState() }
    val reducedMotion = rememberReducedMotion()
    val shake = remember { Animatable(0f) }
    var passwordVisible by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(state.loggedIn) {
        if (state.loggedIn) {
            viewModel.onEvent(AuthUiEvent.ConsumeLoggedIn)
            onLoggedIn()
        }
    }
    LaunchedEffect(state.error, state.shakeToken) {
        state.error?.let { snacks.showSnackbar(it) }
        if (state.shakeToken > 0 && !reducedMotion) {
            // Error shake: 4 quick oscillations, skipped under reduced motion.
            shake.snapTo(0f)
            shake.animateTo(14f, tween(60))
            shake.animateTo(-14f, tween(60))
            shake.animateTo(10f, tween(60))
            shake.animateTo(0f, tween(80))
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp, vertical = 16.dp)
                .offset { IntOffset(shake.value.roundToInt(), 0) },
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandLogo(
                size = BrandLogoSize.DEFAULT,
                showWordmark = true,
                showTagline = true,
            )
            Spacer(Modifier.height(18.dp))
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color(0x2E0A7AFF))
                    .border(0.5.dp, Color(0x660A7AFF), RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Filled.Lock,
                    contentDescription = null,
                    tint = MotormilaPrimaryBright,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "INVITE-ONLY MARKET INTELLIGENCE",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = MotormilaPrimaryBright,
                    letterSpacing = 0.12.sp,
                )
            }
            Spacer(Modifier.height(24.dp))
            PrimaryTabRow(selectedTabIndex = if (state.isSignupTab) 1 else 0) {
                Tab(
                    selected = !state.isSignupTab,
                    onClick = { viewModel.onEvent(AuthUiEvent.TabChanged(false)) },
                    text = { Text("Log in") },
                    modifier = Modifier.heightIn(min = 48.dp),
                )
                Tab(
                    selected = state.isSignupTab,
                    onClick = { viewModel.onEvent(AuthUiEvent.TabChanged(true)) },
                    text = { Text("Sign up") },
                    modifier = Modifier.heightIn(min = 48.dp),
                )
            }
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = state.email,
                onValueChange = { viewModel.onEvent(AuthUiEvent.EmailChanged(it)) },
                label = { Text("Email") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = state.password,
                onValueChange = { viewModel.onEvent(AuthUiEvent.PasswordChanged(it)) },
                label = { Text("Password") },
                singleLine = true,
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = if (passwordVisible) "Hide password" else "Show password",
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            )
            if (state.isSignupTab) {
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = state.inviteToken,
                    onValueChange = { viewModel.onEvent(AuthUiEvent.InviteTokenChanged(it)) },
                    label = { Text("Invite token") },
                    singleLine = true,
                    supportingText = { Text("Invite-only: get a token from /admin or your dealer.") },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                )
            }
            Spacer(Modifier.height(16.dp))
            PrimaryAction(
                label = if (state.isSignupTab) "Create account" else "Log in",
                onClick = { viewModel.onEvent(AuthUiEvent.Submit) },
                loading = state.loading,
            )
            Spacer(Modifier.height(12.dp))
            Card(
                onClick = {
                    viewModel.onEvent(AuthUiEvent.EmailChanged("mobiletest@motormila.lk"))
                    viewModel.onEvent(AuthUiEvent.PasswordChanged("motormila2026"))
                    viewModel.onEvent(AuthUiEvent.Submit)
                },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0x440A7AFF), RoundedCornerShape(14.dp))
                    .semantics { contentDescription = "Quick sign-in with review account" },
                colors = CardDefaults.cardColors(
                    containerColor = Color(0x1A0A7AFF),
                ),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text("Quick Demo Sign-In", style = MaterialTheme.typography.labelMedium, color = MotormilaPrimaryBright, fontWeight = FontWeight.Bold)
                        Text("mobiletest@motormila.lk (Enterprise)", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text("1-Tap Sign In →", style = MaterialTheme.typography.labelSmall, color = MotormilaPrimaryBright, fontWeight = FontWeight.Bold)
                }
            }
            if (biometricEnabled) {
                Spacer(Modifier.height(8.dp))
                Card(
                    onClick = {
                        onBiometricAuth(
                            { viewModel.onEvent(AuthUiEvent.Submit) },
                            { msg -> scope.launch { snacks.showSnackbar(msg) } },
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                        .semantics { contentDescription = "Unlock with biometrics" },
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(16.dp).heightIn(min = 48.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.Fingerprint, contentDescription = null)
                        Text(
                            " Unlock with biometrics",
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(
                "Demo: use any invited email — data stays on this device until the backend links your token.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TextButton(onClick = {}, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Forgot password?")
            }
        }
    }
}
