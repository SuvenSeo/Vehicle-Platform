package lk.motormila.app.di

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import lk.motormila.app.BuildConfig
import lk.motormila.app.data.local.db.MotormilaDatabase

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): MotormilaDatabase {
        val builder = Room.databaseBuilder(context, MotormilaDatabase::class.java, "motormila.db")
        // Destructive migration is debug-only; release must crash loudly instead
        // of wiping watchlists/alerts (see MotormilaDatabase docs).
        if (BuildConfig.DEBUG) builder.fallbackToDestructiveMigration()
        return builder.build()
    }

    @Provides fun listingDao(db: MotormilaDatabase) = db.listingDao()
    @Provides fun watchlistDao(db: MotormilaDatabase) = db.watchlistDao()
    @Provides fun alertDao(db: MotormilaDatabase) = db.alertDao()
    @Provides fun priceHistoryDao(db: MotormilaDatabase) = db.priceHistoryDao()
    @Provides fun statsCacheDao(db: MotormilaDatabase) = db.statsCacheDao()
}
