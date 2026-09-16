package lk.motormila.app.data.repository

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import lk.motormila.app.data.remote.MotormilaApiService
import lk.motormila.app.data.remote.dto.AdminAnalyticsDto
import lk.motormila.app.data.remote.dto.AdminAnalyticsListingsDto
import lk.motormila.app.data.remote.dto.AdminAnalyticsUsersDto
import lk.motormila.app.data.remote.dto.AdminCacheClearDto
import lk.motormila.app.data.remote.dto.AdminDealerDto
import lk.motormila.app.data.remote.dto.AdminDealersResponseDto
import lk.motormila.app.data.remote.dto.AdminFeedbackDto
import lk.motormila.app.data.remote.dto.AdminFeedbackResponseDto
import lk.motormila.app.data.remote.dto.AdminFeedbackUpdateDto
import lk.motormila.app.data.remote.dto.AdminFlagDto
import lk.motormila.app.data.remote.dto.AdminNamedCountDto
import lk.motormila.app.data.remote.dto.AdminPermitDto
import lk.motormila.app.data.remote.dto.AdminPermitUpsertDto
import lk.motormila.app.data.remote.dto.AdminPermitsResponseDto
import lk.motormila.app.data.remote.dto.AdminPipelineResponseDto
import lk.motormila.app.data.remote.dto.AdminPipelineRunDto
import lk.motormila.app.data.remote.dto.AdminPipelineTriggerDto
import lk.motormila.app.data.remote.dto.AdminPipelineTriggerRequestDto
import lk.motormila.app.data.remote.dto.AdminProviderDto
import lk.motormila.app.data.remote.dto.AdminRevcarPilotDto
import lk.motormila.app.data.remote.dto.AdminSystemDto
import lk.motormila.app.data.remote.dto.AdminUserDto
import lk.motormila.app.data.remote.dto.AdminUserUpdateDto
import lk.motormila.app.data.remote.dto.AdminUsersResponseDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AdminRepositoryImplTest {

    private val api: MotormilaApiService = mockk()
    private val repo = AdminRepositoryImpl(api, Dispatchers.Unconfined)

    @Test
    fun users_forwardsQueryAndPlan() = runTest {
        coEvery {
            api.adminUsers(q = "ada", plan = "enterprise", limit = 80, offset = 0)
        } returns AdminUsersResponseDto(
            total = 1,
            users = listOf(AdminUserDto(id = 1, email = "ada@x.lk", name = "Ada", plan = "enterprise")),
        )

        val rows = repo.users(query = "ada", plan = "enterprise")

        assertEquals("enterprise", rows.single().plan)
        coVerify { api.adminUsers(q = "ada", plan = "enterprise", limit = 80, offset = 0) }
    }

    @Test
    fun invites_passNullStatusForHistory() = runTest {
        coEvery { api.adminInvites(status = null, limit = 80) } returns
            lk.motormila.app.data.remote.dto.AdminInvitesResponseDto()

        repo.invites(status = null)

        coVerify { api.adminInvites(status = null, limit = 80) }
    }

    @Test
    fun updateUser_sendsSnakeCaseActiveFlag() = runTest {
        coEvery {
            api.updateAdminUser(4, AdminUserUpdateDto(plan = null, role = "admin", isActive = false))
        } returns AdminUserDto(id = 4, role = "admin", isActive = false)

        val row = repo.updateUser(4, role = "admin", isActive = false)

        assertEquals("admin", row.role)
        assertEquals(false, row.isActive)
    }

    @Test
    fun pipelineAndAnalytics_mapNestedCounts() = runTest {
        coEvery { api.adminPipeline(limit = 50) } returns AdminPipelineResponseDto(
            orphansReconciled = 3,
            runs = listOf(AdminPipelineRunDto(id = 1, source = "ikman", status = "ok")),
        )
        coEvery { api.triggerAdminPipeline(AdminPipelineTriggerRequestDto(job = "alt_sync")) } returns
            AdminPipelineTriggerDto(ok = true, job = "alt_sync", pid = 12)
        coEvery { api.adminAnalytics() } returns AdminAnalyticsDto(
            listings = AdminAnalyticsListingsDto(
                bySource = listOf(AdminNamedCountDto(source = "ikman", count = 9)),
                byDistrict = listOf(AdminNamedCountDto(district = "Colombo", count = 4)),
            ),
            users = AdminAnalyticsUsersDto(
                byPlan = listOf(AdminNamedCountDto(plan = "pro", count = 2)),
            ),
        )

        val pipeline = repo.pipeline()
        val trigger = repo.triggerPipeline("alt_sync")
        val analytics = repo.analytics()

        assertEquals(3, pipeline.orphansReconciled)
        assertEquals("ikman", pipeline.runs.single().source)
        assertEquals(12, trigger.pid)
        assertEquals("ikman", analytics.listings.bySource.single().label)
        assertEquals("Colombo", analytics.listings.byDistrict.single().label)
        assertEquals("pro", analytics.users.byPlan.single().label)
    }

    @Test
    fun desks_mapFeedbackDealerPermitSystemAndPilot() = runTest {
        coEvery { api.adminFeedback(limit = 100, status = null) } returns AdminFeedbackResponseDto(
            feedback = listOf(AdminFeedbackDto(id = 2, category = "idea", message = "Dark mode", status = "open")),
        )
        coEvery { api.updateAdminFeedback(2, AdminFeedbackUpdateDto(status = "resolved")) } returns
            AdminFeedbackDto(id = 2, status = "resolved")
        coEvery { api.adminDealers(limit = 100, status = null) } returns AdminDealersResponseDto(
            dealers = listOf(AdminDealerDto(id = 8, displayName = "Yard", status = "pending")),
        )
        coEvery { api.verifyAdminDealer(8) } returns AdminDealerDto(id = 8, status = "verified")
        coEvery { api.adminPermits() } returns AdminPermitsResponseDto(
            permits = listOf(AdminPermitDto(id = 1, permitName = "EV", permitType = "ev", marketPriceLkr = 9.0)),
        )
        coEvery {
            api.upsertAdminPermit(AdminPermitUpsertDto("EV", "ev", 11.0))
        } returns AdminPermitDto(id = 1, permitName = "EV", permitType = "ev", marketPriceLkr = 11.0)
        coEvery { api.adminSystem() } returns AdminSystemDto(
            databaseOk = true,
            flags = AdminFlagDto(appAccessEnforced = true),
            providers = listOf(AdminProviderDto(id = "revcar", label = "RevCarData", enabled = true, configured = true)),
        )
        coEvery { api.clearAdminCache(key = null) } returns AdminCacheClearDto(ok = true, deleted = 5)
        coEvery { api.runRevcarDataPilot() } returns AdminRevcarPilotDto(ok = true, attempted = 100, matched = 41)

        assertEquals("open", repo.feedback().single().status)
        assertEquals("resolved", repo.updateFeedback(2, "resolved").status)
        assertEquals("pending", repo.dealers().single().status)
        assertTrue(repo.verifyDealer(8).isVerified)
        assertEquals("EV", repo.adminPermits().single().permitName)
        assertEquals(11.0, repo.upsertPermit("EV", "ev", 11.0).marketPriceLkr, 0.0)
        assertTrue(repo.system().databaseOk)
        assertEquals(5, repo.clearCache().deleted)
        assertEquals(41, repo.runRevcarPilot().matched)
    }
}
