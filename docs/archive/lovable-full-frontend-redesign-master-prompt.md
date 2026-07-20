# AutoLens LK Full Frontend Redesign Master Prompt

Use this prompt in Lovable, AI Studio, or another frontend coding agent connected to the current AutoLens LK repository.

```md
You are a senior design systems engineer and frontend architect. Redesign the full AutoLens LK frontend into a high-end, clean, modern Sri Lankan vehicle intelligence platform while preserving every current feature, route, data dependency, and user workflow.

Do not make a generic car marketplace landing page. This product is an intelligence cockpit for Sri Lanka vehicle prices, listings, valuation, trends, maps, dealer tools, and Pro analytics. The redesign must feel like a premium automotive market terminal: precise, trustworthy, dark, data-rich, and polished.

## Product Context

Product name: AutoLens LK
Studio: Ardeno Studio
Primary market: Sri Lanka
Core promise: live vehicle market intelligence built from public listings, source coverage, district pricing, deal scoring, valuation tools, and professional Pro exports.

Current stack:
- React 18 + Vite + TypeScript
- React Router
- TanStack React Query
- Tailwind CSS
- Shadcn/Radix components already installed
- lucide-react icons already installed
- Recharts for analytics
- React Leaflet/Leaflet for maps
- Existing local fonts: Archivo Variable, Geist Sans, Geist Mono
- Existing backend API contract lives in `src/services/api.ts`

Do not replace the stack. Do not remove TypeScript. Do not remove React Query. Do not replace routes. Do not change backend endpoint contracts unless explicitly asked.

## How To Use This Prompt

Paste this whole prompt into Lovable, v0, AI Studio, or another frontend builder that can edit the existing repo.

Ask it to generate code directly inside the current React/Vite frontend. If the tool cannot access the repo, ask it to output a complete `src/` replacement plan with component code grouped by file path. The output must be frontend-only. After export/download, Codex can wire the generated frontend to the existing backend by reconnecting imports, API calls, route guards, and tests.

Do not let the builder create a new backend, new database, new auth system, or fake API. The backend already exists. The job is to redesign the visual interface, information architecture, responsive behavior, and component quality while keeping the product exactly as capable as it is now.

## Non-Negotiable Outcome

Rebuild the full frontend experience, not only the home page. Preserve all current features and workflows:
- Entry loader gate before the app shell
- Sticky app shell navbar, footer, settings floating button, feedback widget, toasts, error boundary, AI chat widget
- Dashboard marketplace cockpit
- Listing search, live suggestions, filters, inventory grid/list, watchlist, compare tray, market alerts
- District market map
- Price history analytics and trend controls
- Valuation studio
- Finance/tax calculator
- EV hub
- Best Picks
- Blogs/journal
- Dealer dashboard
- Listing detail page
- Settings page with language/theme preferences
- Sign-in flow, Pro preview, protected Pro dashboard
- 404 recovery route

The platform must also become emotionally desirable for Sri Lankan users. It should not only look clean; it should make a Sri Lankan buyer, dealer, importer, or serious car enthusiast immediately feel: "this is the smartest place to check vehicle prices before I call a seller." The first screen must create that feeling without exaggerating product claims or hiding the real tools.

Preserve how the platform currently feels conceptually: dark automotive console, AutoLens LK brand, amber/gold signal accent, cyan/green/red market signals, command surfaces, market cards, charts, maps, compact data labels, and decision-tool density. Improve the finish, hierarchy, spacing, responsiveness, and component quality.

## Current UI Audit To Improve

The current product is functionally strong and has the correct dark automotive intelligence direction. Do not throw away the current product structure or make it into a generic car listing site. Improve the existing concept.

Observed current-state issues that the redesign must solve:
- The desktop dashboard has useful cockpit content, but many panels look too similar. Important actions, live metrics, filters, charts, and empty states compete instead of forming a clear journey.
- The homepage hero is on the right track, but it still feels more like an internal dashboard mock than a memorable Sri Lankan vehicle-market product. It needs a stronger first impression, stronger local buyer motivation, and a more desirable search/scan moment.
- The mobile first viewport is cramped. Floating settings, feedback, and AI chat controls can visually compete with hero metrics and lower content. Mobile must prioritize brand, headline, search, quick scans, and 2-3 core signals before extra floating controls.
- Empty and API-failure states can dominate important pages (`/map`, `/best-picks`, `/pro`) and make the product feel less alive. Keep truthful error states, but style them as polished recovery/diagnostic states with next actions.
- Chart containers can produce width/height warnings when data or container sizing is weak. Every chart/map container needs stable min-height, min-width, and responsive constraints.
- Secondary product routes such as EV Hub, Best Picks, Map, Dealer, Settings, and Pro Preview are real product areas but are not always obvious from top navigation. Improve discoverability through nav grouping, footer, command menu, contextual links, and dashboard modules without cluttering the primary nav.
- Some page copy already sounds premium, but layout density and repeated card treatments make pages feel more generic than the product deserves. Add distinct page-level compositions.

Current strengths to preserve:
- Dark near-black automotive console.
- Amber/gold brand signal with cyan/green/red market status accents.
- Sri Lanka-specific language, LKR pricing, districts, local marketplace source coverage, and makes/models.
- High-density data tools: filters, charts, maps, valuation, calculators, watchlist, compare, alerts, Pro reports.
- Existing local fonts, component primitives, API helpers, auth guards, export logic, and tests.

## Market Positioning For Sri Lanka

Position AutoLens LK as the place Sri Lankan buyers and professionals check before calling a seller, negotiating, importing, financing, or recommending a vehicle.

Primary audience:
- Individual buyers comparing asking prices before calling sellers.
- Families upgrading cars who need confidence on fair price, mileage, district, and seller trust.
- Dealers and importers watching supply, demand, arbitrage, and source freshness.
- Lenders, insurers, analysts, and serious enthusiasts who need district and model-level signals.

Core message:
- "Know the real vehicle price before you call."
- Back that message with live listings, LKR price bands, district trends, deal score, source transparency, seller trust, valuation, finance/tax planning, watchlist, alerts, and Pro report exports.

Local trust signals:
- Use familiar search chips and examples: Toyota Aqua, Honda Vezel, Suzuki Wagon R, Nissan Leaf, Toyota Axio, Toyota Premio, Hilux, Land Cruiser, BMW, Mercedes-Benz.
- Use district and city cues: Colombo, Gampaha, Kandy, Kurunegala, Galle, Matara, Jaffna, all-district coverage where data exists.
- Use source transparency around current source families from the backend such as Ikman, Riyasewana, AutoLanka, Patpat, Carshop, SaleMe, Cars at DIMO, and any available market signal sources.
- Never over-claim. Say "tracked sources", "public marketplace listings", "available source coverage", or "current indexed market" unless the API proves complete national coverage.

Promotional feel:
- The product should feel trustworthy, sharp, and locally useful, not flashy for its own sake.
- The UI should make a user think: "I should check AutoLens before I call, bargain, lease, import, or list my car."
- Make fairness, savings, risk avoidance, and negotiation confidence visible in the first screen.

## Exact Information Architecture And Placement

Global shell:
- Fixed floating top nav on all public app routes except standalone sign-in and standalone Pro shell.
- Left: logo, AutoLens LK wordmark, Ardeno Studio line.
- Center desktop: primary links only: Overview, Market, Trends, Valuation, Calculator, Blog.
- Add a compact "More" or command menu for EV Hub, Best Picks, Map, Dealer, Settings, Pro Preview, and Pro when signed in. Do not overcrowd the main nav.
- Right: live sync chip, Sign In or user state, Pro CTA where relevant, repository link if kept.
- Floating controls: Settings, Feedback, and AI chat must avoid covering important mobile CTAs. On mobile, stack them in a compact lower-right cluster with safe spacing from bottom sheets and compare tray.
- Footer: group links as Explore, Tools, Pro, Studio, Sources/Operations, and include source/status metrics.

Dashboard top-to-bottom layout:
1. Hero command cockpit:
   - Left/top: local market badge, `AutoLens LK`, strong Sri Lankan buyer headline, supporting copy.
   - Primary search command bar with live suggestions and scan action.
   - Quick scan chips for local models.
   - 2-4 live trust metrics: priced listings, districts, sources, latest sync.
   - Right/secondary desktop panel: live index board with average price, MoM change, source status, best signal, new listings, and district/source pulses.
   - Mobile: collapse into one column: brand, headline, search, chips, metrics, then compact live board.
2. Market concentration:
   - District map/heatmap with a short local interpretation panel.
   - Empty/error state must explain data is waiting and link to inventory/trends.
3. Price history analytics:
   - Trend controls on top, selected chips, chart workspace, buy timing signal.
4. Optional dashboard valuation/predictor modules:
   - Quick valuation and `MarketPredictor`, kept near analytics rather than buried below inventory.
5. Live inventory:
   - Header with counts, saved count, alerts, grid/list toggle.
   - Desktop: left sticky filter command rail; right results grid/list.
   - Mobile/tablet: filter drawer/sheet with active filter chips always visible above results.
   - Results: cards/list rows, skeletons, empty state, pagination.
   - Floating compare tray appears only when items are selected and never covers AI chat or mobile nav.
6. Operational strip:
   - Pipeline/source status, latest sync, source transparency, feedback entry.

Standalone route placement:
- `/listing/:id`: inspection-report page. Media/vehicle identity first, price/trust sidebar second, specs and market comparison below, source transparency and peer listings at the end.
- `/trends`: chart studio. Hero metrics, filter command row, chart workspace, coverage note, fallback action.
- `/estimate`: valuation workbench. Inputs left, output right on desktop; mobile stacks inputs then result.
- `/calculator`: finance desk. Baseline assumptions first, lease/tax modules below, planning reserve and sensitivity tiles after.
- `/ev-hub`: EV decision lane. Battery, duty/policy, charging, readiness matrix, inventory link, ownership checklist.
- `/best-picks`: curated deal lane. Deal-score explanation, qualified picks metrics, ranked cards, strict empty/error states.
- `/blogs`: market intelligence journal. Featured briefing, topic filters/search, active article, buyer playbook, live research stack.
- `/map`: district intelligence room. Full-width map first, summary console adjacent or above, district metrics and recovery states.
- `/dealer`: operations cockpit. Command stack, metrics, lead notification, collapsible analytics widgets.
- `/settings`: calm preferences page. Language cards, theme cards, active state, back to dashboard.
- `/sign-in`: secure standalone access page. Form and review credentials left, Pro value pitch right on desktop.
- `/pro-preview`: high-trust locked preview. Preview metrics, locked lane/source/report cards, clear sign-in and public-browse actions.
- `/pro`: professional market terminal. Sticky Pro top bar, hero/freshness/export controls, command mode cards, tabs, metrics/tables/detail dialogs/report composer.
- `*`: route recovery page with links back to dashboard, trends, map, and inventory.

## Visual Direction

Create a premium automotive intelligence system, not a decorative landing page.

Theme:
- Default dark mode.
- Page background: near-black/slate, e.g. `#050607`, `slate-950`, `zinc-950`.
- Main surfaces: `zinc-900/80`, `#0b0e0d`, `#101312`, translucent black panels.
- Borders: very soft `white/[0.06]`, `zinc-800/60`, `amber-300/20` only for emphasis.
- Accent: restrained amber/gold around `#e0aa48` and `#f1c66d`.
- Secondary signals: cyan for data freshness, green for positive signals, rose/red for risk or overpriced items.
- Typography: use existing `Archivo Variable` for headlines, `Geist` for body, `Geist Mono` for technical labels/numbers.
- Radius: keep mostly 8-12px. Avoid giant pill cards everywhere.
- Shadows: subtle black depth plus low-intensity amber/cyan glows. Avoid loud neon.
- Background treatment: faint grid, soft radial signal glow, subtle noise/texture if possible. Do not use big decorative blobs.

The design should feel like:
- Bloomberg terminal clarity
- Porsche configurator restraint
- Linear/Stripe-level interface polish
- Automotive inspection cockpit
- Professional dealer/investor dashboard
- Sri Lankan market relevance: Colombo/Gampaha/Kandy/district-aware signals, LKR price hierarchy, familiar makes such as Toyota Aqua, Honda Vezel, Suzuki Wagon R, Nissan Leaf, Toyota Axio, Hilux, and Land Cruiser

## Sri Lanka-Loved Hero And Adoption Mandate

The homepage hero must be the strongest visual moment in the product. Make it eye-catching enough for Sri Lankan people to remember, share, and actually use, while still being a real working command surface.

Hero concept:
- A cinematic Sri Lanka vehicle-market command cockpit.
- Dark premium automotive background with subtle grid, road/market signal lines, LKR price ticks, district pulses, and source-feed motion.
- Strong brand lockup: `AutoLens LK` with a headline that communicates instant market clarity.
- Suggested headline direction: "Know the real vehicle price before you call."
- Suggested supporting copy: "Live Sri Lanka listings, deal scores, valuation bands, district trends, and seller-risk signals in one clean market cockpit."
- Include a prominent search/scan command bar as the hero's primary action, not a passive CTA.
- Include quick scan chips for popular local searches: Toyota Aqua, Honda Vezel, Suzuki Wagon R, Nissan Leaf, Toyota Axio, BMW, Mercedes-Benz.
- Include live trust signals near the hero: priced listings tracked, districts indexed, source feeds watched, latest sync, average market price.
- Include an insight board on the right side with animated but subtle market cards: Colombo supply, Gampaha demand, hybrid trend, best deal score, new listings today.
- The first viewport must hint at the live inventory section below so users immediately understand this is usable, not just marketing.

Hero visual treatment:
- Use a full-bleed or wide hero scene that feels premium and local. If using images, use real vehicle imagery or tasteful automotive silhouettes, never stretched placeholders.
- Avoid cartoon graphics, fake 3D cars, generic stock dealership photos, or random luxury cars unrelated to Sri Lankan usage.
- Use micro-motion carefully: scanning line, pulse dots, slow shimmer on the command bar, live-source dots, chart sparkline animation.
- Use high-contrast text. The hero should be dramatic, but all text must be readable on 375px mobile.
- The hero must collapse into a mobile-first search cockpit: brand, headline, command bar, quick scans, and 2-3 live metrics before the fold.

Whole-platform emotional quality:
- Every major page should feel like a useful premium tool, not a disconnected template.
- Make each route visually memorable with a clear page-specific concept:
  - Dashboard: market cockpit.
  - Listing detail: vehicle inspection report.
  - Trends: chart studio.
  - Estimate: valuation workbench.
  - Calculator: finance desk.
  - Map: district intelligence room.
  - Dealer: operator command center.
  - Pro: paid market terminal.
  - Blogs: market intelligence journal.
- Keep Sri Lankan market language visible: LKR, districts, local source coverage, local buyer/dealer workflows, import/duty/finance context.
- Make the product feel immediately useful to someone checking Ikman/Riyasewana-style listings before calling a seller.

Avoid:
- Generic Tailwind cards in a plain grid
- Overused purple/blue gradient SaaS style
- Oversized landing-page hero filler
- Harsh borders
- Low contrast gray text
- Stretched vehicle images
- Unstyled select inputs
- Text overlap on mobile
- Removing useful data because it is visually hard

## Current Route Inventory To Preserve

### App Shell

Preserve `src/App.tsx` behavior:
- Entry `Loader` gate stored with session key `autolens.has_entered`.
- `QueryClientProvider`, `AuthProvider`, `AppPreferencesProvider`, `TooltipProvider`.
- Main layout includes `Navbar`, `SettingsFloatingIcon`, `FeedbackWidget`, delayed `AIChatWidget`, `AppFooter`.
- Main content offset for fixed nav.
- Lazy-loaded pages and minimal loading state.

Improve:
- Loader should feel premium and fast: automotive scan/startup sequence, no cheesy animation.
- App shell should have consistent spacing and page rhythm.
- Page transitions should be subtle and non-blocking.

### `/` Dashboard

Preserve all dashboard features:
- Hero section with `AutoLens LK` and subtitle `Precision Vehicle Intelligence`.
- Search input with live listing suggestions.
- Quick scans: Toyota Aqua, Mercedes-Benz, BMW, Honda Vezel.
- Market pulse metrics: priced listings, districts indexed, source feeds watched.
- Live market instrument panel: average index price, month-over-month change, signal cards, scrape/source flow.
- District market map section.
- Price history analytics section with make/model trend controls and `PriceHistoryChart`.
- `MarketPredictor`.
- Live inventory section.
- Sticky filter system with:
  - Inventory mode: priced vs missing-price listings
  - Sort: newest, best deal, price asc/desc, mileage
  - Fast Picks
  - Keyword
  - Source
  - Make and dependent model selector
  - Condition
  - Body type
  - Year range
  - Price range and presets
  - Mileage max
  - Fuel
  - Transmission
  - District
  - Filter coverage summary
- Results count and grid/list toggle.
- Listing skeletons, empty state, pagination.
- Listing cards with image, price, deal score, confidence/integrity, market position bar, metadata, source, district, dealer/private, watchlist and compare controls.
- List view variant.
- Floating compare tray for up to 3 selected vehicles.
- Compare modal.
- Market alerts dialog with target price, saved filters, open/delete actions.
- Pipeline status bar.

Redesign direction:
- Hero should be a refined split command cockpit, not a generic centered hero.
- Search should be a glass command bar with suggestions as a premium command menu.
- Convert the current sidebar into a polished `Market Filter Command Rail`: desktop sticky rail, tablet collapsible panel, mobile bottom sheet/drawer.
- Keep filter density but group it better with disclosure groups, segmented controls, sliders, and compact chips.
- Listing grid must be 1 column mobile, 2 tablet, 3 desktop.
- Vehicle images must use stable `aspect-[16/10] object-cover` containers.
- Preserve price-unavailable handling and do not mix invalid prices into deal-score browsing.

### `/listing/:id` Listing Detail

Preserve:
- Listing load by ID.
- Error state if record cannot load.
- Large vehicle/price header.
- Price unavailable fallback.
- Share button.
- Metadata: year, mileage, transmission, fuel, condition, body.
- Deal score label and visual status.
- Seller trust profile: seller type/name, listing count, ratings/reviews if present, phone/WhatsApp previews, verified badges.
- Listing age/tracked-days context.
- Description.
- Market peers/similar listings.
- External source link.

Redesign direction:
- Make it feel like an inspection report page.
- Layout: image/media column, price and trust sidebar, specs bento, peer comparison table/cards.
- Keep source transparency obvious.
- Make unknown or missing values look intentional, not broken.

### `/trends`

Preserve:
- Trend studio hero.
- Make selector.
- Dependent model selector.
- Condition selector.
- District selector.
- Selected filter chips.
- `PriceHistoryChart` with loading, empty, coverage note, and broader-lane action.

Redesign direction:
- Make this a clean chart workspace.
- Controls should be an integrated command surface above the chart.
- Chart tooltip and empty state should match the premium dashboard style.

### `/estimate`

Preserve:
- Valuation studio hero.
- Inputs: make, model, year, condition, transmission, fuel type, mileage, district.
- `Run Live Valuation` action.
- API estimate call and error handling.
- Output: estimated median, low/high band, confidence, comparable count, mileage adjustment, trajectory/projection, methodology.

Redesign direction:
- Make it feel like a valuation workbench.
- Use two-column layout desktop: inputs left, valuation output right.
- On mobile, stack inputs before output.
- Use strong number hierarchy and restrained charts/bands.

### `/calculator`

Preserve:
- Finance desk hero.
- Vehicle value/CIF input.
- Engine capacity input.
- Lease calculator component.
- Tax breakdown component.
- Planning reserve, duty sensitivity, monthly buffer tiles.

Redesign direction:
- Make it feel like a finance planning desk.
- Inputs should feel precise, with inline number formatting where possible.
- Keep the calculation local and immediate.

### `/ev-hub`

Preserve:
- EV intelligence hero.
- Battery health, duty/policy, charging readiness modules.
- Readiness matrix.
- Browse electric inventory link with `?fuel_type=electric#market`.
- Ownership planning checks.

Redesign direction:
- This should feel like a specialized EV decision lane, not a generic article.
- Use compact modules and a decision checklist surface.

### `/best-picks`

Preserve:
- Deal-score filtered inventory.
- Strict minimum deal-score gate.
- Qualified picks, minimum score, pages scanned metrics.
- Loading/error/empty states.
- Listing cards or high-quality pick cards.

Redesign direction:
- Make it feel curated and editorial but still data-backed.
- Use ranking, score bands, and deal rationale.

### `/blogs`

Preserve:
- Market intelligence journal.
- Search by topics/tags/market angles.
- Topic/category filters.
- Featured research/playbook areas.
- Interactive buyer playbook.
- Browse live research stack.

Redesign direction:
- Make it feel like a premium market intelligence publication inside the app.
- Avoid marketing blog fluff. Keep it signal-first.

### `/map`

Preserve:
- Geo intelligence hero.
- District map loading/error states.
- `MarketMap` with district pricing.
- Summary cards: supply center, premium pressure, mapped inventory.

Redesign direction:
- Full-width map workspace with a left or top summary console.
- Map should not look trapped in a heavy card; give it room.
- Preserve responsive map height.

### `/dealer`

Preserve:
- Dealer workspace hero.
- Command stack aside.
- Metrics: live lead queue, arbitrage alerts, finance-ready leads.
- Rotating lead notification.
- Collapsible widgets:
  - Inventory Turnover chart
  - Price Gaps vs Competitors chart
  - District Demand Heatmap cards

Redesign direction:
- Make it feel like a dealer operations cockpit.
- Keep the sidebar useful but compact.
- Improve collapsible widgets into premium dashboard modules.

### `/settings`

Preserve:
- Settings hero.
- Language options: English, Sinhala, Tamil.
- Theme options: system, dark, light.
- Active theme display.
- Back to dashboard action.

Redesign direction:
- Keep it calm and simple.
- Use selectable cards with check indicators and icon support.

### `/sign-in`

Preserve:
- Standalone sign-in page outside main app shell.
- Email/password form with validation.
- Show/hide password.
- Demo/review credentials if enabled.
- Pro preview link when preview access is enabled.
- Production auth fallback message.
- Error/loading states.
- Right-side Pro Intelligence feature pitch on desktop.
- Redirect authenticated users back to requested route.

Redesign direction:
- Make it feel secure and premium.
- Do not expose fake claims. If auth is demo-only, label it clearly as review credentials.

### `/pro-preview`

Preserve:
- Locked Pro teaser.
- Preview metrics.
- Locked lane drill-downs.
- Locked source/area chart.
- What Pro adds.
- Locked report formats.
- Sign-in and browse-public-data actions.

Redesign direction:
- Make the lock state high-trust, not annoying.
- Use blurred overlays, clear upgrade messaging, and clean preview data.

### `/pro`

Preserve protected access and all Pro dashboard features:
- Sticky Pro top bar with home link, refresh, plan pill, sign out.
- Hero: Paid professional intelligence.
- Data freshness and export buttons.
- Command buttons.
- Tabs: Overview, Vehicles, Areas, Trends, Sources, Reports.
- Overview:
  - Priced listings
  - Median price
  - New 7 days
  - Hot deals
  - Top opportunities
  - Source mix chart
- Vehicles:
  - Search lanes
  - District filter
  - Source filter
  - Focus filter: all, hot deal lanes, broad coverage, fresh supply
  - Table with vehicle, listings, median, range, avg deal, districts, source
  - Detail dialog for lane drill-down
- Areas:
  - District profile cards
  - Listing count, median, source count, top make/model
  - Detail dialog
- Trends:
  - Select vehicle lane
  - Price chart
  - Export detail report
- Sources:
  - Source coverage/freshness cards
  - Count, share, average price, latest seen
  - Detail dialog
- Reports:
  - Report composer
  - Scope: market, vehicle, district, source, lanes table, districts table
  - Target selector
  - Format: PDF, Word/DOCX, CSV, JSON, Print
  - Theme/style selector
  - Custom title, prepared for, subtitle, analyst note
  - Section checkboxes
  - Listing row limit
  - Preview chips
  - Download custom report
  - Quick packs: executive market pack, vehicle lane table, district opportunity pack
- Footer note about public marketplace aggregation.
- AIChatWidget inside Pro.

Redesign direction:
- This must feel like the highest-value paid area.
- Improve information architecture without reducing data.
- Tables must remain readable and horizontally usable on mobile.
- Reports composer should feel like a professional report builder, not a form dump.

### `*` Not Found

Preserve:
- 404 route unavailable hero.
- Recovery links to inventory cockpit, price trends, district map.

## Shared Components To Upgrade, Not Delete

Upgrade these components while keeping their responsibilities:
- `Navbar`: sticky floating nav, brand, route links, live sync status, sign-in/pro state, GitHub repo link/stars, mobile menu.
- `AppFooter`: platform links, workspace links, studio links, source coverage metrics, market operations online.
- `PlatformPageHero`: reusable page hero with eyebrow, title, description, icon, metrics, actions.
- `ListingCard`: preserve all actions and data; improve image handling, badges, price hierarchy, metadata, market position, hover states.
- `FilterSidebar`: turn into premium command rail/drawer while preserving every filter.
- `PriceHistoryChart`: premium chart shell, clear empty/loading/coverage states.
- `MarketMap` and `DistrictHeatmap`: avoid broken map sizing; keep responsive.
- `PipelineStatusBar`: keep operational status readable.
- `AIChatWidget`: keep page-aware prompt suggestions and listing results.
- `FeedbackWidget`: keep categories, route, email/message, offline fallback.
- `SettingsFloatingIcon`: keep access to preferences.
- `ComparisonModal`: preserve comparison logic.
- `SignInPortalModal`: keep modal sign-in path.
- `Loader`: preserve entry flow, improve polish.

## Premium Component Blueprints

Use the existing Shadcn/Radix primitives plus custom Tailwind classes. Use inspiration from Aceternity UI, Magic UI, Shadcn Blocks, Origin UI, and Float UI, but adapt to this repo and do not blind copy-paste.

1. App Shell Navigation
- Floating glass navbar with soft border and backdrop blur.
- Active route pill with low-contrast filled state.
- Live sync chip with small pulsing status dot.
- Pro/sign-in CTA as a premium amber button.
- Mobile nav as a compact full-width command panel.

2. Dashboard Hero Command Console
- Left: brand headline, concise value proposition, command search.
- Right: live market pulse instrument panel.
- Command search suggestions should feel like a command menu with prices/source/district.
- Include quick scan chips and live stats.
- Make this the most eye-catching screen in the entire app: cinematic local vehicle-market command cockpit, strong headline, live metrics, animated source/district signals, and a scan/search experience that feels instantly useful.
- Do not make the hero a plain text block beside generic cards. It must have a memorable visual composition and still remain functional.
- Use Sri Lankan buyer psychology: people want to know whether the asking price is fair, whether there are better deals nearby, whether the seller/source is trustworthy, and whether prices are moving. Surface those motivations directly in the hero.

3. Filter Command Rail
- Desktop: sticky rail with grouped panels and mini summary.
- Tablet/mobile: drawer or sheet with same groups.
- Use segmented controls for priced/missing-price, sort options, condition/body/fuel/transmission.
- Use sliders for year, price, mileage.
- Use combobox/select for source, make, model, district.
- Always show active filters as removable chips.

4. Vehicle Listing Card
- `aspect-[16/10]` image container, `object-cover`, no stretching.
- Top badges: condition, deal label, high confidence if applicable.
- Price overlay on image when available; `Price unavailable` badge otherwise.
- Strong vehicle title/year.
- Compact metadata grid: transmission, mileage, fuel, engine cc, body, seller type.
- Market position bar.
- Footer: district, source, open/details action.
- Watchlist and compare icon buttons with visible selected state.

5. Analytics Panels
- Use bento-like grids for KPIs.
- Keep charts in calm panels with strong axis/tooltip contrast.
- Use tabular numbers and concise labels.
- Empty states should explain the missing data and offer the broader fallback action when available.

6. Pro Dashboard
- Use a professional command center layout.
- Command buttons at top should act like workspace mode cards.
- Tabs should be readable and icon-supported.
- Data tables should have sticky headers where useful and horizontal scroll on mobile.
- Detail dialogs should have metrics, trend, source/district mix, listings, and export actions.
- Report composer should use a two-pane layout: scope/details left, contents/preview right.

7. Forms
- All inputs should be styled, not raw.
- Use labels, hints, validation errors, loading states, disabled states.
- Keep keyboard and focus states accessible.

8. Modals, Drawers, Toasts
- Use Radix/Shadcn Dialog, Sheet, Tabs, Select, Slider, Tooltip, Badge, Button, Input, Skeleton.
- Overlay backgrounds should be dark and premium.
- Dialogs should fit mobile viewports.

## Data And State Rules

Do not remove or fake current data flows:
- Use `src/services/api.ts` for all backend calls.
- Preserve `API_BASE` behavior and env variables.
- Preserve `LISTINGS_PAGE_SIZE`.
- Preserve `FilterState` URL/filter mapping.
- Preserve priced vs price-unavailable logic.
- Preserve `isReasonableListingPrice` guards.
- Preserve watchlist and market alerts logic in local storage/helpers.
- Preserve authentication and protected route behavior.
- Preserve app preferences for language and theme.
- Preserve AI chat page context and listing result rendering.
- Preserve report export logic in `src/lib/proReports.ts` and `src/lib/proReportCustomize.ts`.
- Do not hardcode live inventory or Pro data into the UI except existing preview/mock teaser pages.

Use the current API functions:
- `getStats`
- `getLiveMarketSnapshot`
- `getListings`
- `getListing`
- `getSellerTrustProfile`
- `getSimilarListings`
- `getDistrictPrices`
- `getListingSearchSuggestions`
- `getListingSources`
- `estimatePrice`
- `estimateCustomVehicle`
- `getPriceTrendSeries`
- `getPriceTrends`
- `getPipelineRuns`
- `triggerPipelineJob`
- `getDashboardInsights`
- `getProMarketSnapshot`
- `getProVehicleLanes`
- `getProDistricts`
- `getProVehicleLaneDetail`
- `getProDistrictDetail`
- `getListingsForExport`
- `getDistrictQuickInsight`
- `sendChatMessage`
- `sendFeedback`

## Implementation Constraints

Work frontend-only unless a compile error proves a contract mismatch:
- Prefer editing `src/index.css`, shared UI components, `Navbar`, `AppFooter`, `PlatformPageHero`, `ListingCard`, `FilterSidebar`, and page components.
- Keep route structure in `src/App.tsx`.
- Keep current tests valid.
- Keep imports clean and remove unused imports.
- Do not delete accessibility labels.
- Do not introduce Framer Motion unless already present or explicitly approved; use CSS transitions and Tailwind animations first.
- Do not add heavy dependencies for basic UI effects.
- Do not break Vite build.
- Do not change env variable names.
- Do not remove demo auth safeguards or Pro access gates.

## Responsive Rules

Must pass:
- 375px mobile
- 768px tablet
- 1024px laptop
- 1440px desktop

Rules:
- No horizontal overflow at 375px.
- Navbar must not overlap content or trap controls.
- Hero must show the next section hint on first viewport.
- Dashboard filters must be usable on mobile through a drawer/sheet.
- Vehicle cards must remain readable with stable image aspect ratios.
- Tables must scroll horizontally on small screens without breaking page width.
- Pro report composer must stack cleanly on mobile.
- Map must have stable height and not collapse.
- AI chat must not cover critical bottom CTAs without being dismissible.
- Floating compare tray must fit mobile width.

## Accessibility And UX Requirements

- Use semantic headings in order.
- Buttons must be buttons, links must be links.
- Every icon-only button needs an aria-label or tooltip.
- Maintain visible focus states.
- Keep color contrast high, especially zinc text on dark backgrounds.
- Avoid relying only on color for deal status.
- Loading, empty, error, selected, disabled, hover, active, and focus states must exist.
- Forms must have labels and useful validation/error messages.

## Detailed Acceptance Criteria

The redesign is complete only when:
1. All routes render without runtime errors:
   - `/`
   - `/listing/:id`
   - `/trends`
   - `/estimate`
   - `/calculator`
   - `/blogs`
   - `/ev-hub`
   - `/best-picks`
   - `/map`
   - `/dealer`
   - `/settings`
   - `/sign-in`
   - `/pro-preview`
   - `/pro`
   - invalid route / 404
2. The dashboard still supports search suggestions, filters, grid/list view, watchlist, compare, market alerts, pagination, trends, map, and pipeline status.
3. Listing detail still loads real listing data and similar/peer context.
4. Valuation and trend pages still call the API and show loading/error/empty states.
5. Calculator still updates lease/tax outputs from inputs.
6. Pro sign-in, preview, protected route, tabs, detail dialogs, and report exports remain functional.
7. Images never stretch; all vehicle media uses stable aspect-ratio containers.
8. No unstyled select/input/control remains in important workflows.
9. No page has text overlap or horizontal overflow at 375px.
10. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass or any failure is clearly explained with exact file/error.

## Visual Verification Mission

After implementation:
1. Run `npm install` only if package files changed or `node_modules` is missing.
2. Run:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run build`
3. Start the dev server with `npm run dev`.
4. Open the app in a browser.
5. Capture/check at 375px, 768px, and 1440px:
   - Home dashboard hero
   - Inventory filters and cards
   - Listing detail
   - Trend page
   - Estimate page
   - Calculator
   - Map page
   - Dealer page
   - Sign-in
   - Pro preview
   - Pro dashboard tabs and report composer
6. Inspect browser console for runtime errors.
7. Fix any overflow, clipped text, dead controls, broken image ratios, or console errors.
8. Repeat until checks pass.

## Output Requirements

When finished, report:
- Files changed
- Routes redesigned
- Features preserved
- Tests/build results
- Browser viewport checks performed
- Known remaining risks

Do not say the redesign is complete unless browser verification was actually performed.
```
