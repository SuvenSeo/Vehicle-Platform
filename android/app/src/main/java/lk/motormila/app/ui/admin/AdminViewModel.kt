package lk.motormila.app.ui.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import lk.motormila.app.core.network.ErrorMapper
import lk.motormila.app.domain.model.AdminInviteRow
import lk.motormila.app.domain.model.AdminOverview
import lk.motormila.app.domain.model.AdminUserRow
import lk.motormila.app.domain.repository.AdminRepository
import lk.motormila.app.domain.usecase.ObserveSessionUseCase

data class AdminUiState(
    val isAdmin: Boolean = false,
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val tab: Int = 0,
    val overview: AdminOverview? = null,
    val users: List<AdminUserRow> = emptyList(),
    val invites: List<AdminInviteRow> = emptyList(),
    val inviteEmail: String = "",
    val invitePlan: String = "free",
    val sendingInvite: Boolean = false,
    val lastInviteToken: String? = null,
    val error: String? = null,
)

sealed interface AdminUiEvent {
    data object Refresh : AdminUiEvent
    data class TabChanged(val index: Int) : AdminUiEvent
    data class InviteEmailChanged(val value: String) : AdminUiEvent
    data class InvitePlanChanged(val value: String) : AdminUiEvent
    data object SendInvite : AdminUiEvent
    data class RevokeInvite(val id: Int) : AdminUiEvent
    data class SetUserPlan(val userId: Int, val plan: String) : AdminUiEvent
    data object DismissError : AdminUiEvent
}

@HiltViewModel
class AdminViewModel @Inject constructor(
    private val admin: AdminRepository,
    observeSession: ObserveSessionUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow(AdminUiState())
    val state: StateFlow<AdminUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            observeSession().collect { session ->
                val isAdmin = session?.isAdmin == true
                _state.update { it.copy(isAdmin = isAdmin) }
                if (isAdmin) load()
            }
        }
    }

    fun onEvent(event: AdminUiEvent) {
        when (event) {
            AdminUiEvent.Refresh -> load(refreshing = true)
            is AdminUiEvent.TabChanged -> _state.update { it.copy(tab = event.index) }
            is AdminUiEvent.InviteEmailChanged -> _state.update { it.copy(inviteEmail = event.value) }
            is AdminUiEvent.InvitePlanChanged -> _state.update { it.copy(invitePlan = event.value) }
            AdminUiEvent.SendInvite -> sendInvite()
            is AdminUiEvent.RevokeInvite -> revoke(event.id)
            is AdminUiEvent.SetUserPlan -> setPlan(event.userId, event.plan)
            AdminUiEvent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun load(refreshing: Boolean = false) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = !refreshing, isRefreshing = refreshing, error = null) }
            runCatching {
                val overview = admin.overview()
                val users = admin.users()
                val invites = admin.invites()
                Triple(overview, users, invites)
            }.onSuccess { (overview, users, invites) ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        overview = overview,
                        users = users,
                        invites = invites,
                    )
                }
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        error = ErrorMapper.map(error).message,
                    )
                }
            }
        }
    }

    private fun sendInvite() {
        val email = _state.value.inviteEmail.trim()
        if (email.isBlank() || '@' !in email) {
            _state.update { it.copy(error = "Enter a valid email to invite.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(sendingInvite = true, error = null) }
            runCatching { admin.createInvite(email, _state.value.invitePlan) }
                .onSuccess { invite ->
                    _state.update {
                        it.copy(
                            sendingInvite = false,
                            inviteEmail = "",
                            lastInviteToken = invite.token,
                            invites = listOf(invite) + it.invites.filter { row -> row.id != invite.id },
                        )
                    }
                }
                .onFailure { error ->
                    _state.update { it.copy(sendingInvite = false, error = ErrorMapper.map(error).message) }
                }
        }
    }

    private fun revoke(id: Int) {
        viewModelScope.launch {
            runCatching { admin.revokeInvite(id) }
                .onSuccess { _state.update { it.copy(invites = it.invites.filterNot { row -> row.id == id }) } }
                .onFailure { error -> _state.update { it.copy(error = ErrorMapper.map(error).message) } }
        }
    }

    private fun setPlan(userId: Int, plan: String) {
        viewModelScope.launch {
            runCatching { admin.updateUserPlan(userId, plan) }
                .onSuccess { updated ->
                    _state.update { state ->
                        state.copy(users = state.users.map { if (it.id == updated.id) updated else it })
                    }
                }
                .onFailure { error -> _state.update { it.copy(error = ErrorMapper.map(error).message) } }
        }
    }
}
