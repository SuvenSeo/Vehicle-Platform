package lk.motormila.app.ui.navigation

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import lk.motormila.app.core.network.AuthEventBus
import lk.motormila.app.data.local.datastore.SessionStore

@HiltViewModel
class NavGraphViewModel @Inject constructor(
    val authEventBus: AuthEventBus,
    val sessionStore: SessionStore,
) : ViewModel()
