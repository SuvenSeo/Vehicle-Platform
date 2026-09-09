package lk.motormila.app.ui.district

import androidx.lifecycle.SavedStateHandle
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import lk.motormila.app.domain.model.DistrictInsight
import lk.motormila.app.domain.model.DistrictStat
import lk.motormila.app.domain.model.HubTopModel
import lk.motormila.app.domain.model.Listing
import lk.motormila.app.domain.repository.ListingRepository
import lk.motormila.app.domain.repository.ListingSorts
import lk.motormila.app.domain.repository.StatsRepository
import lk.motormila.app.domain.usecase.ObserveWatchlistUseCase
import lk.motormila.app.domain.usecase.ToggleWatchlistUseCase
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DistrictHubViewModelTest {

    private val dispatcher = UnconfinedTestDispatcher()
    private val stats: StatsRepository = mockk()
    private val listings: ListingRepository = mockk()
    private val toggleWatchlist: ToggleWatchlistUseCase = mockk()
    private val observeWatchlist: ObserveWatchlistUseCase = mockk()

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        every { observeWatchlist() } returns flowOf(emptyList())
        coEvery { stats.districtPrices() } returns emptyList()
        coEvery { stats.districtVelocity() } returns emptyList()
        coEvery { listings.searchPage(any(), any(), any()) } returns emptyList()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun load_populatesInsightListingsAndDisplayName() {
        coEvery { stats.districtInsight("Colombo") } returns insight(district = "Colombo")
        coEvery { listings.searchPage(any(), page = 1, size = 8) } returns listOf(listing(id = 11))

        val vm = viewModel("Colombo")
        val state = vm.state.value

        assertFalse(state.isLoading)
        assertEquals("Colombo", state.displayName)
        assertEquals(42, state.insight?.listingCount)
        assertEquals(listOf(11), state.listings.map { it.id })
        assertTrue(state.hasContent)
        assertNull(state.error)
    }

    @Test
    fun load_titleCasesSlugWhenInsightDistrictBlank() {
        coEvery { stats.districtInsight("nuwara-eliya") } returns insight(district = "")
        coEvery { listings.searchPage(any(), any(), any()) } returns emptyList()

        val vm = viewModel("nuwara-eliya")

        assertEquals("Nuwara Eliya", vm.state.value.displayName)
        assertEquals("nuwara-eliya", vm.state.value.searchDistrict)
    }

    @Test
    fun load_networkFailureWithoutContent_setsErrorAndOffline() {
        coEvery { stats.districtInsight("Galle") } throws IOException("offline")
        coEvery { listings.searchPage(any(), any(), any()) } throws IOException("offline")

        val vm = viewModel("Galle")
        val state = vm.state.value

        assertFalse(state.isLoading)
        assertTrue(state.offline)
        assertFalse(state.hasContent)
        assertTrue(state.error?.isNotBlank() == true)
    }

    @Test
    fun load_listingsSurviveInsightFailure() {
        coEvery { stats.districtInsight("Kandy") } throws IOException("timeout")
        coEvery { listings.searchPage(any(), any(), any()) } returns listOf(listing(id = 7))

        val vm = viewModel("Kandy")
        val state = vm.state.value

        assertTrue(state.hasContent)
        assertEquals(listOf(7), state.listings.map { it.id })
        assertEquals("Kandy", state.displayName)
        assertNull(state.insight)
        assertTrue(state.offline)
        assertNull(state.error)
    }

    @Test
    fun load_nearbyExcludesCurrentDistrict() {
        coEvery { stats.districtInsight("Colombo") } returns insight(district = "Colombo")
        coEvery { stats.districtPrices() } returns listOf(
            districtStat("Colombo", count = 90, lat = 6.9, lng = 79.8),
            districtStat("Gampaha", count = 40, lat = 7.0, lng = 80.0),
            districtStat("Kandy", count = 20, lat = 7.3, lng = 80.6),
        )

        val vm = viewModel("Colombo")

        assertEquals(listOf("Gampaha", "Kandy"), vm.state.value.nearby.map { it.district })
    }

    @Test
    fun load_requestsNewestPageOfEight() {
        coEvery { stats.districtInsight("Matara") } returns insight(district = "Matara")

        viewModel("Matara")

        coVerify {
            listings.searchPage(
                match { query ->
                    query.district == "Matara" && query.sort == ListingSorts.NEWEST
                },
                page = 1,
                size = 8,
            )
        }
    }

    @Test
    fun blankDistrict_skipsNetworkAndShowsEmpty() {
        val vm = viewModel("  ")

        assertFalse(vm.state.value.isLoading)
        assertFalse(vm.state.value.hasContent)
        assertNull(vm.state.value.error)
        coVerify(exactly = 0) { stats.districtInsight(any()) }
        coVerify(exactly = 0) { listings.searchPage(any(), any(), any()) }
    }

    @Test
    fun toggleWatch_invokesUseCase() {
        coEvery { stats.districtInsight("Colombo") } returns insight(district = "Colombo")
        val row = listing(id = 3)
        coEvery { listings.searchPage(any(), any(), any()) } returns listOf(row)
        coEvery { toggleWatchlist(row) } returns true

        val vm = viewModel("Colombo")
        vm.onEvent(DistrictHubUiEvent.ToggleWatch(row))

        coVerify { toggleWatchlist(row) }
    }

    private fun viewModel(district: String): DistrictHubViewModel =
        DistrictHubViewModel(
            stats = stats,
            listings = listings,
            toggleWatchlist = toggleWatchlist,
            observeWatchlist = observeWatchlist,
            savedStateHandle = SavedStateHandle(mapOf("district" to district)),
        )

    private fun insight(district: String): DistrictInsight = DistrictInsight(
        district = district,
        listingCount = 42,
        avgPriceLkr = 9_000_000.0,
        medianPriceLkr = 8_000_000.0,
        changePct30d = -1.5,
        topModels = listOf(
            HubTopModel(make = "Honda", model = "Vezel", listingCount = 9, avgPriceLkr = 12_000_000.0),
        ),
    )

    private fun listing(id: Int): Listing = Listing(
        id = id,
        title = "Toyota Aqua",
        make = "Toyota",
        model = "Aqua",
        year = 2017,
        priceLkr = 5_000_000.0,
        mileageKm = 40_000.0,
        fuelType = "Hybrid",
        transmission = "Auto",
        condition = "Used",
        bodyType = "Hatchback",
        district = "Colombo",
        city = null,
        source = "ikman",
        thumbnailUrl = null,
        dealScore = 8.0,
        marketMedianLkr = 5_200_000.0,
        scrapedAt = null,
        firstSeenAt = null,
        lastSeenAt = null,
        detailUrl = null,
        externalUrl = null,
        engineCc = null,
    )

    private fun districtStat(
        name: String,
        count: Int,
        lat: Double,
        lng: Double,
    ): DistrictStat = DistrictStat(
        district = name,
        lat = lat,
        lng = lng,
        count = count,
        avgPriceLkr = 8_000_000.0,
        medianPriceLkr = 7_000_000.0,
    )
}
