package lk.motormila.app.ui.scan

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
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
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.Executors
import lk.motormila.app.core.format.formatLkr
import lk.motormila.app.core.ui.PrimaryAction

/**
 * Plate scanner: CameraX preview + ML Kit OCR overlay + plate candidate chips.
 * Tap a chip (or type manually) → plate lookup → search/FMV callbacks.
 *
 * Never crashes when the camera is absent: checks FEATURE_CAMERA_ANY and wraps
 * bind in runCatching, falling back to the manual-entry card.
 *
 * Required gradle deps (gradle owner):
 * `androidx.camera:camera-camera2`, `camera-lifecycle`, `camera-view`,
 * `com.google.mlkit:text-recognition`.
 * Required manifest (manifest owner): CAMERA permission + MainActivity
 * `motormila://scan` deep link.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class, ExperimentalGetImage::class)
@Composable
fun PlateScanScreen(
    onSearchPlate: (plate: String) -> Unit,
    onOpenFmv: (listingId: Int) -> Unit,
    viewModel: PlateScanViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current
    val snacks = remember { SnackbarHostState() }
    var overlayBoxes by remember { mutableStateOf<List<FloatRect>>(emptyList()) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        viewModel.onEvent(PlateScanUiEvent.PermissionResult(granted, showRationale = !granted))
    }

    LaunchedEffect(Unit) {
        val hasCamera = context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
        viewModel.onEvent(PlateScanUiEvent.CameraAvailability(hasCamera))
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        if (granted) {
            viewModel.onEvent(PlateScanUiEvent.PermissionResult(true, showRationale = false))
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    LaunchedEffect(state.error) {
        state.error?.let {
            snacks.showSnackbar(it)
            viewModel.onEvent(PlateScanUiEvent.DismissError)
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Scan plate") }) },
        snackbarHost = { SnackbarHost(snacks) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            if (state.permissionGranted && state.cameraAvailable) {
                CameraPreview(
                    onOcrText = { text, boxes ->
                        overlayBoxes = boxes
                        viewModel.onEvent(PlateScanUiEvent.OcrText(text))
                    },
                    modifier = Modifier.fillMaxWidth().height(280.dp)
                        .semantics { contentDescription = "Camera preview for plate scanning" },
                )
                Spacer(Modifier.height(8.dp))
                OcrOverlay(
                    boxes = overlayBoxes,
                    modifier = Modifier.fillMaxWidth().height(24.dp),
                )
            } else {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            when {
                                !state.cameraAvailable -> "No camera on this device — type the plate below."
                                state.permissionRationaleVisible ->
                                    "Camera access lets you scan plates. You can also type the plate below."
                                else -> "Camera permission needed — or type the plate below."
                            },
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        if (!state.cameraAvailable.not() && !state.permissionGranted) {
                            PrimaryAction("Grant camera access", onClick = {
                                permissionLauncher.launch(Manifest.permission.CAMERA)
                            })
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
            }

            if (state.ocrCandidates.isNotEmpty()) {
                Text("Tap a plate to search", style = MaterialTheme.typography.titleSmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    state.ocrCandidates.forEach { plate ->
                        FilterChip(
                            selected = state.selectedPlate == plate,
                            onClick = { viewModel.onEvent(PlateScanUiEvent.CandidateSelected(plate)) },
                            label = { Text(plate) },
                            modifier = Modifier.heightIn(min = 48.dp),
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
            }

            // Manual fallback — always available.
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = state.manualEntry,
                    onValueChange = { viewModel.onEvent(PlateScanUiEvent.ManualChanged(it)) },
                    label = { Text("Plate (e.g. CAB-1234)") },
                    singleLine = true,
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                )
            }
            Spacer(Modifier.height(8.dp))
            PrimaryAction(
                "Look up plate",
                onClick = { viewModel.onEvent(PlateScanUiEvent.LookupManual) },
                loading = state.lookingUp,
            )

            state.result?.let { r ->
                Spacer(Modifier.height(12.dp))
                Card(
                    Modifier.fillMaxWidth()
                        .semantics { contentDescription = "Plate result for ${state.selectedPlate}" },
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(state.selectedPlate.orEmpty(), style = MaterialTheme.typography.titleMedium)
                        Text(
                            if (r.listingsFound > 0) "${r.listingsFound} matching listings" else "No live listings on this plate",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        r.fmvLkr?.let { Text("FMV ${formatLkr(it)}", style = MaterialTheme.typography.titleSmall) }
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AssistChip(
                                onClick = { onSearchPlate(state.selectedPlate.orEmpty()) },
                                label = { Text("Search") },
                                modifier = Modifier.heightIn(min = 48.dp),
                            )
                            r.listingId?.let { id ->
                                AssistChip(
                                    onClick = { onOpenFmv(id) },
                                    label = { Text("Open FMV") },
                                    modifier = Modifier.heightIn(min = 48.dp),
                                )
                            }
                        }
                    }
                }
            }

            if (state.lookingUp) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.padding(16.dp))
                }
            }
        }
    }
}

/** Relative rect (0..1) for overlay boxes. */
private data class FloatRect(val l: Float, val t: Float, val r: Float, val b: Float)

@androidx.annotation.OptIn(ExperimentalGetImage::class)
@Composable
private fun CameraPreview(
    onOcrText: (text: String, boxes: List<FloatRect>) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current
    val executor = remember { Executors.newSingleThreadExecutor() }
    val recogniser = remember { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { recogniser.close() }
            runCatching { executor.shutdown() }
        }
    }

    AndroidView(
        factory = { ctx ->
            PreviewView(ctx).also { preview ->
                val providerFuture = ProcessCameraProvider.getInstance(ctx)
                providerFuture.addListener({
                    runCatching {
                        val provider = providerFuture.get()
                        val previewUse = androidx.camera.core.Preview.Builder().build().also {
                            it.surfaceProvider = preview.surfaceProvider
                        }
                        val analysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()
                            .also { ia ->
                                ia.setAnalyzer(executor) { imageProxy ->
                                    val media = imageProxy.image
                                    if (media == null) {
                                        imageProxy.close()
                                        return@setAnalyzer
                                    }
                                    val image = InputImage.fromMediaImage(media, imageProxy.imageInfo.rotationDegrees)
                                    recogniser.process(image)
                                        .addOnSuccessListener { vision ->
                                            val w = imageProxy.width.toFloat()
                                            val h = imageProxy.height.toFloat()
                                            onOcrText(
                                                vision.text,
                                                vision.textBlocks.map { b ->
                                                    val box = b.boundingBox
                                                    if (box == null) FloatRect(0f, 0f, 0f, 0f)
                                                    else FloatRect(
                                                        box.left / w, box.top / h,
                                                        box.right / w, box.bottom / h,
                                                    )
                                                }.filter { it.r > it.l && it.b > it.t },
                                            )
                                        }
                                        .addOnCompleteListener { imageProxy.close() }
                                }
                            }
                        provider.unbindAll()
                        provider.bindToLifecycle(
                            lifecycle, CameraSelector.DEFAULT_BACK_CAMERA, previewUse, analysis,
                        )
                    }
                }, ContextCompat.getMainExecutor(ctx))
            }
        },
        modifier = modifier,
    )
}

/** Thin OCR overlay strip rendering recognised block boxes. */
@Composable
private fun OcrOverlay(boxes: List<FloatRect>, modifier: Modifier = Modifier) {
    Canvas(modifier.semantics { contentDescription = "Detected text regions" }) {
        boxes.forEach { b ->
            drawRect(
                color = Color(0xFF2E7D32),
                topLeft = Offset(b.l * size.width, 0f),
                size = Size((b.r - b.l) * size.width, size.height),
                style = Stroke(width = 3f),
            )
        }
    }
}
