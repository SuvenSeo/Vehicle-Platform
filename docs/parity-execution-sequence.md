# Parity Execution Sequence

Date: 2026-04-18
Phase: 5 (sub-project sequence and execution gates)

## Execution Model

This rollout follows strict phase checkpoints:

1. Implement phase scope
2. Run verification commands for impacted backend/frontend tests
3. Commit with phase-specific message
4. Push to feature branch and main
5. Verify deployment trigger state

User instruction for this session confirms automatic execution and acts as approval to proceed through the sequence without pause.

## Ordered Sub-Projects

### Phase 6: Data Platform Core Parity

Primary objective:
- Improve aggregate computation quality and data-contract reliability.

Planned deliverables:
- Deterministic median/p25/p75 computation from listing-level prices.
- Unit tests for aggregate math and upsert behavior.

Exit criteria:
- Backend tests for aggregate logic pass.
- Existing runtime guard tests still pass.

### Phase 7: Ingestion Pipeline Parity

Primary objective:
- Canonicalize source accounting across ingestion and monitoring.

Planned deliverables:
- Source alias canonicalization in listing counts and run accounting.
- Tests proving alias groups resolve correctly.

Exit criteria:
- Ingestion guard test suite passes with new canonicalization rules.

### Phase 8: Scheduler and Operations Parity

Primary objective:
- Add actionable operations API surface for monitoring and trigger control.

Planned deliverables:
- Pipeline run-history endpoint.
- Controlled trigger endpoint for sync jobs.
- Status payload improvements for operational clarity.

Exit criteria:
- New endpoint tests pass.
- Existing pipeline status endpoint remains backward compatible.

### Phase 9: Frontend and Dashboard Parity

Primary objective:
- Expose operational parity features directly in dashboard UX.

Planned deliverables:
- Frontend API helpers for run history and trigger actions.
- Dashboard panel for recent runs and manual trigger controls.
- Frontend tests for new API normalization and rendering safety.

Exit criteria:
- Vitest suite passes for impacted modules.
- Build succeeds.

## Commit Convention

Per-phase commit titles:

- `docs: complete phase 5 execution sequence`
- `feat: complete phase 6 data platform parity`
- `feat: complete phase 7 ingestion parity`
- `feat: complete phase 8 scheduler ops parity`
- `feat: complete phase 9 dashboard ops parity`
