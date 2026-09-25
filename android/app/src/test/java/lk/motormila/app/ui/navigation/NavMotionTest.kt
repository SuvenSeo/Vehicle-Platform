package lk.motormila.app.ui.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NavMotionTest {

    @Test
    fun pushFractions_stayShortOfFullWidth() {
        assertEquals(0.12f, NAV_PUSH_ENTER_FRACTION, 0.0001f)
        assertEquals(0.08f, NAV_PUSH_EXIT_FRACTION, 0.0001f)
        assertTrue(NAV_PUSH_ENTER_FRACTION < 0.25f)
        assertTrue(NAV_PUSH_EXIT_FRACTION < NAV_PUSH_ENTER_FRACTION)
    }

    @Test
    fun reducedMotion_enterAndExitDoNotThrow() {
        assertNotNull(motormilaEnterTransition(reducedMotion = true, tabSwitch = false))
        assertNotNull(motormilaExitTransition(reducedMotion = true, tabSwitch = true))
        assertNotNull(motormilaPopEnterTransition(reducedMotion = true, tabSwitch = false))
        assertNotNull(motormilaPopExitTransition(reducedMotion = true, tabSwitch = true))
    }

    @Test
    fun tabAndPush_enterTransitionsDiffer() {
        val tab = motormilaEnterTransition(reducedMotion = false, tabSwitch = true)
        val push = motormilaEnterTransition(reducedMotion = false, tabSwitch = false)
        assertNotEquals(tab, push)
    }

    @Test
    fun isTabSwitch_onlyWhenBothAreTabs() {
        assertTrue(isTabSwitch(Home::class.qualifiedName, Search::class.qualifiedName))
        assertFalse(isTabSwitch(Home::class.qualifiedName, ListingDetail::class.qualifiedName))
        assertFalse(isTabSwitch(null, Search::class.qualifiedName))
    }
}
