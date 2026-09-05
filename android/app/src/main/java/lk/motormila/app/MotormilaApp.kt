package lk.motormila.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import okhttp3.OkHttpClient
import javax.inject.Inject

@HiltAndroidApp
class MotormilaApp : Application(), SingletonImageLoader.Factory, Configuration.Provider {

    @Inject
    lateinit var okHttpClient: OkHttpClient

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(workerFactory).build()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun newImageLoader(context: coil3.PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components {
                add(OkHttpNetworkFetcherFactory(callFactory = { okHttpClient }))
            }
            .crossfade(true)
            .build()

    private fun createNotificationChannels() {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        val channels = listOf(
            NotificationChannel(
                CHANNEL_PRICE_DROPS,
                getString(R.string.channel_price_drops),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = getString(R.string.channel_price_drops_desc) },
            NotificationChannel(
                CHANNEL_MARKET_NEWS,
                getString(R.string.channel_market_news),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply { description = getString(R.string.channel_market_news_desc) },
            NotificationChannel(
                CHANNEL_SYNC,
                getString(R.string.channel_sync),
                NotificationManager.IMPORTANCE_LOW,
            ).apply { description = getString(R.string.channel_sync_desc) },
        )
        nm.createNotificationChannels(channels)
    }

    companion object {
        const val CHANNEL_PRICE_DROPS = "price_drops"
        const val CHANNEL_MARKET_NEWS = "market_news"
        const val CHANNEL_SYNC = "sync"
    }
}
