package lk.motormila.app.fcm

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import lk.motormila.app.core.notifications.NotificationHelper
import lk.motormila.app.data.local.datastore.SettingsStore

const val LISTING_DEEP_LINK_PREFIX = "motormila://listing/"
const val WATCHLIST_DEEP_LINK = "motormila://watchlist"

/** Push kinds routed to NotificationHelper channels. Pure + unit-testable. */
fun fcmChannelFor(kind: String?): String = when (kind) {
    "price_drop", "alert_match" -> NotificationHelper.CHANNEL_PRICE_DROPS
    else -> NotificationHelper.CHANNEL_MARKET_NEWS
}

/** In-app listing deep link. Manifest + NavHost: motormila://listing/{id}. */
fun listingDeepLink(listingId: Int): String = "$LISTING_DEEP_LINK_PREFIX$listingId"

/** Fallback when a push/alert has no listing id. */
fun watchlistDeepLink(): String = WATCHLIST_DEEP_LINK

/**
 * Notification tap target: listing detail when [listingId] is present,
 * otherwise the watchlist shortcut URI.
 */
fun notificationTapUri(listingId: Int?): String =
    if (listingId != null) listingDeepLink(listingId) else watchlistDeepLink()

/** VIEW intent scoped to this app so the tap never leaks to a browser. */
fun listingTapIntent(context: Context, listingId: Int?): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(notificationTapUri(listingId))).apply {
        `package` = context.packageName
        setClassName(context.packageName, "lk.motormila.app.MainActivity")
    }

fun listingTapPendingIntent(
    context: Context,
    listingId: Int?,
    requestCode: Int,
): PendingIntent? = runCatching {
    PendingIntent.getActivity(
        context,
        requestCode,
        listingTapIntent(context, listingId),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}.getOrNull()

/**
 * Push receiver (Firebase-free stub).
 *
 * The Firebase Messaging dependency is not on the classpath and no FCM
 * service is declared in the manifest, so this class deliberately does NOT
 * extend FirebaseMessagingService. When a push backend lands:
 * 1. add `com.google.firebase:firebase-messaging` + google-services plugin,
 * 2. re-introduce the Firebase subclass and forward its callbacks into
 *    [onNewToken] / [onMessageReceived] below,
 * 3. register the token via POST /devices (backend TODO) — [onNewToken]
 *    already persists it to [SettingsStore] for that call.
 * Every body is wrapped in runCatching so push handling can never crash the app.
 *
 * POST_NOTIFICATIONS (API 33+): [NotificationHelper.hasPermission] gates posts;
 * request it from MainActivity via ActivityResultContracts.RequestPermission
 * before subscribing (see subscribePostLogin call sites).
 */
@Singleton
class MotormilaFcmService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settings: SettingsStore,
    private val notifications: NotificationHelper,
) {

    companion object {
        const val TOPIC_PRICE_DROPS = "motormila_price_drops"
        const val TOPIC_MARKET_NEWS = "motormila_market_news"

        private const val TAG = "MotormilaFcm"

        /** No-op until a push backend exists; runs after login. */
        fun subscribePostLogin() = runCatching {
            Log.d(TAG, "subscribe (no-op): $TOPIC_PRICE_DROPS, $TOPIC_MARKET_NEWS")
        }

        /** No-op until a push backend exists; runs on logout. */
        fun unsubscribeAll() = runCatching {
            Log.d(TAG, "unsubscribe (no-op): $TOPIC_PRICE_DROPS, $TOPIC_MARKET_NEWS")
        }
    }

    /** Persist the device token for the (future) backend registration call. */
    suspend fun onNewToken(token: String) {
        runCatching {
            settings.setFcmToken(token)
        }
    }

    /** Route an incoming push to the matching local notification channel. */
    fun onMessageReceived(title: String, body: String, kind: String?, id: Int, listingId: Int? = null) {
        runCatching {
            val tap = listingTapPendingIntent(context, listingId, id)
            when (fcmChannelFor(kind)) {
                NotificationHelper.CHANNEL_PRICE_DROPS ->
                    notifications.notifyPriceDrop(id, title, body, contentIntent = tap)
                else -> notifications.notifyMarketNews(id, title, body, contentIntent = tap)
            }
        }
    }
}
