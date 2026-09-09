package lk.motormila.app.ui.navigation

import lk.motormila.app.domain.repository.ListingQuery
import lk.motormila.app.domain.repository.ListingSorts

/**
 * Maps Search destination primitive args (deep-link extras / SavedStateHandle)
 * into a [ListingQuery]. Pure JVM — no Android types.
 *
 * Blank strings are treated as absent. [q] wins over [plate] for the keyword
 * (same order as SearchViewModel.applyRouteArgs).
 */
fun searchArgsToQuery(
    q: String? = null,
    district: String? = null,
    make: String? = null,
    model: String? = null,
    sort: String? = null,
    plate: String? = null,
): ListingQuery {
    return ListingQuery(
        keyword = q.blankToNull() ?: plate.blankToNull(),
        make = make.blankToNull(),
        model = model.blankToNull(),
        district = district.blankToNull(),
        sort = sort.blankToNull() ?: ListingSorts.NEWEST,
    )
}

fun searchArgsToQuery(route: Search): ListingQuery = searchArgsToQuery(
    q = route.q,
    district = route.district,
    make = route.make,
    model = route.model,
    sort = route.sort,
    plate = route.plate,
)

private fun String?.blankToNull(): String? = this?.trim()?.takeIf { it.isNotEmpty() }
