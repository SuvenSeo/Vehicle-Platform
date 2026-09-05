package lk.motormila.app.fcm

import android.util.Log
import javax.inject.Inject
import javax.inject.Singleton
import lk.motormila.app.core.notifications.NotificationHelper
import lk.motormila.app.data.local.datastore.SettingsStore

/**
 * Push receiver (Firebase-free stub).
 *
 * The Firebase Messaging dependency is not on the classpath and no FCM
 * service is declared in the manifest, so this class deliberately does NOT
 * extend FirebaseMessagingService. When a push backend lands, re-introduce
 * the Firebase subclass and forward its callbacks into [onNewToken] /
 * [onMessageReceived] below. Every body is wrapped in runCatching so push
 * handling can never crash the app.
 */
@Singleton
class MotormilaFcmService @Inject constructor(
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
    fun onMessageReceived(title: String, body: String, kind: String?, id: Int) {
        runCatching {
            when (kind) {
                "price_drop" -> notifications.notifyPriceDrop(id, title, body, contentIntent = null)
                else -> notifications.notifyMarketNews(id, title, body, contentIntent = null)
            }
        }
    }
}
