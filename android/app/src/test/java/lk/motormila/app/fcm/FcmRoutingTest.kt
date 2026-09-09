package lk.motormila.app.fcm

import lk.motormila.app.core.notifications.NotificationHelper
import org.junit.Assert.assertEquals
import org.junit.Test

/** FCM kind → channel routing. Pure JVM. Swarm E owned. */
class FcmRoutingTest {

    @Test
    fun priceDrop_goesHighChannel() {
        assertEquals(NotificationHelper.CHANNEL_PRICE_DROPS, fcmChannelFor("price_drop"))
        assertEquals(NotificationHelper.CHANNEL_PRICE_DROPS, fcmChannelFor("alert_match"))
    }

    @Test
    fun unknown_goesNewsChannel() {
        assertEquals(NotificationHelper.CHANNEL_MARKET_NEWS, fcmChannelFor(null))
        assertEquals(NotificationHelper.CHANNEL_MARKET_NEWS, fcmChannelFor("market_news"))
        assertEquals(NotificationHelper.CHANNEL_MARKET_NEWS, fcmChannelFor("whatever"))
    }

    @Test
    fun listingId_buildsListingDeepLink() {
        assertEquals("motormila://listing/42", listingDeepLink(42))
        assertEquals("motormila://listing/42", notificationTapUri(42))
    }

    @Test
    fun missingListingId_buildsWatchlistDeepLink() {
        assertEquals("motormila://watchlist", watchlistDeepLink())
        assertEquals("motormila://watchlist", notificationTapUri(null))
    }
}
