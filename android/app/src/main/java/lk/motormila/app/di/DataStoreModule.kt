package lk.motormila.app.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Qualifier
import javax.inject.Singleton

private val Context.sessionDataStore by preferencesDataStore(name = "session")
private val Context.settingsDataStore by preferencesDataStore(name = "settings")

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class SessionDataStore

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class SettingsDataStore

@Module
@InstallIn(SingletonComponent::class)
object DataStoreModule {
    @Provides @Singleton @SessionDataStore
    fun sessionStore(@ApplicationContext context: Context): DataStore<Preferences> =
        context.sessionDataStore

    @Provides @Singleton @SettingsDataStore
    fun settingsStore(@ApplicationContext context: Context): DataStore<Preferences> =
        context.settingsDataStore
}
