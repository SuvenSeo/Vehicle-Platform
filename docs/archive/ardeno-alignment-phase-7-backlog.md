# Ardeno Alignment Phase 7 Backlog Packaging (2026-04-19)

## Objective

Package deferred work into execution-ready epics with effort, risk, and rollout sequencing.

## Backlog Epics

| Epic ID | Epic | Scope | Effort | Risk |
|---|---|---|---|---|
| B1 | Scraper Technical Field Enrichment | Improve `fuel_type`, `transmission`, `body_type`, and `condition` extraction fallbacks across scraper sources and cleaner paths. | Medium | Medium |
| B2 | Scraper Runtime Guard Expansion | Add source-specific fixtures and guard tests for mixed-format metadata and edge-case payloads. | Medium | Low |
| B3 | Frontend Test Warning Hardening | Resolve repeated `act(...)` warnings and React Router future-flag noise in test harnesses. | Low | Low |
| B4 | Frontend Bundle Optimization | Reduce largest frontend chunk size using route-level code-splitting and manual chunk strategy review. | Medium | Medium |
| B5 | Tooling and Repo Hygiene | Update browserslist metadata and reduce noise from tracked Python cache artifacts in local workflows. | Low | Low |

## Rollout Order

1. `B1` Scraper Technical Field Enrichment
2. `B2` Scraper Runtime Guard Expansion
3. `B3` Frontend Test Warning Hardening
4. `B4` Frontend Bundle Optimization
5. `B5` Tooling and Repo Hygiene

## Sequencing Rationale

- `B1` and `B2` land first because data quality improvements have the highest end-user trust impact.
- `B3` follows to improve CI signal quality and reduce false-positive noise during release gates.
- `B4` then improves production delivery and runtime performance once behavior is stable.
- `B5` is a final cleanup stream after higher-impact product and CI improvements are secured.

## Exit Criteria for Phase 7

- Deferred work is split into clear epics with explicit scope boundaries.
- Each epic has effort and risk labels for prioritization.
- A deterministic rollout sequence is documented for execution planning.