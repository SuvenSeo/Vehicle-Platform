# Ardeno Alignment Phase 0 Baseline and Guardrails (2026-04-19)

## Scope and intent

This baseline locks the Ardeno-alignment implementation contract before UX and trust upgrades are applied.

## Brand transfer contract

- Keep AutoLens market semantics intact.
- Preserve emerald-driven deal and market-signal affordances.
- Import Ardeno style language only in typography hierarchy, motion cadence, and signature footer treatments.
- Do not perform wholesale palette replacement that weakens price/deal readability.

## Baseline surfaces to preserve behavior

- Loader and app entry surface: src/App.tsx and src/components/Loader.tsx
- Global navigation shell: src/components/Navbar.tsx
- Dashboard listing grid and sidebar balance: src/pages/Dashboard.tsx and src/components/FilterSidebar.tsx
- Listing card readability and metadata scanability: src/components/ListingCard.tsx
- Footer consistency across dashboard and listing detail: src/pages/Dashboard.tsx and src/pages/ListingDetail.tsx

## Acceptance matrix for implementation phases

- Density and hierarchy:
  - Listing cards remain readable at mobile and desktop breakpoints after compaction.
  - Sidebar spacing rhythm aligns with listing card density.
- Entry and motion:
  - Entry is user-controlled, not auto-dismissed by timer.
  - Reduced-motion mode is honored for large transitions.
- Trust and reliability:
  - Freshness and provenance are explicit in UI where data is surfaced.
  - Pipeline health messaging is human-readable and avoids silent ambiguity.
- Accessibility:
  - Keyboard focus is preserved for entry, sign-in shell, and top navigation actions.
  - Active navigation states remain visible on desktop and mobile.

## Verification checkpoints

- Frontend: npm run test and npm run build
- Backend: pytest backend/tests -q
- Manual checks for entry flow, listing density, navbar active-state clarity, and trust labels

## Out of scope for this implementation stream

- Full authentication backend and entitlement system
- New premium feature gating logic
- Advanced AI simulator modules
