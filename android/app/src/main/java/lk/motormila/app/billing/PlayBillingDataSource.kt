package lk.motormila.app.billing

import android.app.Activity
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.queryProductDetails
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.CheckoutIntentRequestDto

/**
 * Play Billing wrapper. Server checkout is manual-first (backend
 * POST /billing/checkout-intent returns a URL or contact-sales message), so
 * this data source exposes BOTH paths:
 * - [checkoutIntent]: server fallback (always available, manual provider).
 * - [launchProUpgrade]: native Play flow when the Play product is configured;
 *   returns false when Play is unavailable so UI falls back to checkoutIntent.
 */
@Singleton
class PlayBillingDataSource @Inject constructor(
    private val api: MotormilaApiService,
) : BillingDataSource {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _state = MutableStateFlow<BillingState>(BillingState.Idle)
    override val state: StateFlow<BillingState> = _state.asStateFlow()

    private var client: BillingClient? = null

    override suspend fun checkoutIntent(plan: String): CheckoutInfo = withContext(Dispatchers.IO) {
        val res = api.checkoutIntent(CheckoutIntentRequestDto(plan))
        CheckoutInfo(provider = res.provider, checkoutUrl = res.checkoutUrl, message = res.message)
    }

    override suspend fun launchProUpgrade(activity: Activity, productId: String): Boolean =
        withContext(Dispatchers.IO) {
            val billingClient = getClient(activity) ?: return@withContext false
            val params = QueryProductDetailsParams.newBuilder()
                .setProductList(
                    listOf(
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(productId)
                            .setProductType(BillingClient.ProductType.SUBS)
                            .build(),
                    ),
                ).build()
            val result = runCatching { billingClient.queryProductDetails(params) }.getOrNull()
                ?: return@withContext false
            val details: ProductDetails = result.productDetailsList?.firstOrNull()
                ?: return@withContext false
            val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
                ?: return@withContext false
            val flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(
                    listOf(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(details)
                            .setOfferToken(offerToken)
                            .build(),
                    ),
                ).build()
            val launch = withContext(Dispatchers.Main) {
                billingClient.launchBillingFlow(activity, flowParams)
            }
            launch.responseCode == BillingClient.BillingResponseCode.OK
        }

    private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
        scope.launch {
            _state.value = when (result.responseCode) {
                BillingClient.BillingResponseCode.OK ->
                    BillingState.Purchased(purchases?.mapNotNull { it.orderId } ?: emptyList())
                BillingClient.BillingResponseCode.USER_CANCELED -> BillingState.Idle
                else -> BillingState.Error(result.debugMessage)
            }
        }
    }

    private suspend fun getClient(activity: Activity): BillingClient? {
        client?.let { if (it.isReady) return it }
        return runCatching {
            val c = BillingClient.newBuilder(activity)
                .setListener(purchasesListener)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build()
            client = c
            var ready = false
            c.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    ready = result.responseCode == BillingClient.BillingResponseCode.OK
                }
                override fun onBillingServiceDisconnected() { /* retry on next call */ }
            })
            // startConnection is async; readiness is re-checked by callers via isReady.
            if (!c.isReady) {
                kotlinx.coroutines.delay(1500)
            }
            c.takeIf { it.isReady || ready }
        }.getOrNull()
    }
}

interface BillingDataSource {
    val state: StateFlow<BillingState>
    suspend fun checkoutIntent(plan: String): CheckoutInfo
    suspend fun launchProUpgrade(activity: Activity, productId: String): Boolean
}

sealed interface BillingState {
    data object Idle : BillingState
    data object Loading : BillingState
    data class Purchased(val orderIds: List<String>) : BillingState
    data class Error(val message: String) : BillingState
}

data class CheckoutInfo(
    /** "manual" | "payhere" | "stripe". manual = contact-sales fallback. */
    val provider: String,
    val checkoutUrl: String?,
    val message: String,
) {
    val hasUrl: Boolean get() = !checkoutUrl.isNullOrBlank()
}
