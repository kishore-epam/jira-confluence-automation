# Implementation Plan: USF-PLAN Weekly Status Reporting Platform

## Plan basis

This plan turns the requirements in [specification.md](./specification.md) and principles in [constitution.md](./constitution.md) into four ordered implementation phases. Each milestone has a verifiable exit condition. The task-level breakdown, acceptance criteria, and dependencies are in [tasks.md](./tasks.md). In Phase 3, features are implemented and accepted sequentially; do not begin the next feature until the current feature's tests and acceptance checks pass.

The prototype remains single-user and local-only on a dedicated Windows account. The application uses React 18.3.1/Vite 7.3.7, Node.js 24.22.1/Express 5.3.0, PostgreSQL 15, and a scheduled Python 3.12 worker. Source inputs are controlled CSV files. Direct connectors, XLSX import, forecasting, report distribution, remote access, and production deployment are excluded.

## Delivery rules

- Preserve the separation of responsibilities: React UI, Express API, PostgreSQL persistence, and Python report generation.
- Keep all services bound to loopback. Never expose the worker token, database credentials, person-level capacity rows, or unapproved report content.
- Treat the project manager's saved update as canonical. Report runs capture the exact PM update revision, source inputs, and settings version they use.
- For each feature slice: agree its API/data contract, implement backend and tests, implement its UI, run focused checks, and verify its acceptance criteria before proceeding.
- Use deterministic fixtures and a controllable scheduled-trigger clock for reporting-window, DST, retry, and calculation tests.
- No stage may silently substitute stale data, fabricate unavailable measures, or overwrite the latest good report on failure.
- Estimates and calendar dates are intentionally not assigned; the plan specifies sequence and measurable exit conditions.

## Phase 1: Backend setup (database, API skeleton)

**Goal:** Establish a secure, runnable backend foundation and stable contracts before feature work.

**Tasks:** T-001 through T-009 in [tasks.md](./tasks.md).

### Milestone 1.1 — Runtime and local-service bootstrap

- Confirm the dedicated Windows account and obtain confirmation that Windows Credential Manager is an approved local secret store. If approval is absent, stop secret-dependent implementation until an approved store is identified.
- Pin Node.js to `24.22.1`, declare the Node 24 engine line, and establish committed lockfiles for the backend package.
- Add `docker-compose.yml` with only PostgreSQL 15, a named data volume, and loopback-only port binding.
- Add a startup wrapper that retrieves credentials from Windows Credential Manager without writing them to `.env`, source, shell history, or logs. Restrict Docker access as specified.
- Establish local input, report, and log directories with the required Windows ACLs; document non-secret configuration.

**Exit checks:** The documented startup procedure runs PostgreSQL and the backend only on loopback; a health check reports API/database readiness without leaking versions, paths, configuration, or secrets. Credential-store approval and Docker access restrictions are verified.

### Milestone 1.2 — API skeleton and boundary protections

- Create the Express application with versioned route registration, request validation, consistent safe error responses, correlation IDs, and structured privacy-safe logging.
- Enforce loopback connections, the exact configured Vite origin, loopback Host validation, and origin checks on state-changing browser requests.
- Add worker bearer-token validation for internal routes. Retrieve the token only in the API/worker process context; never expose it to browser code or log it.
- Implement `/healthz`, database connectivity handling, upload-size limits, pagination defaults/caps, and API error status conventions.
- Add test harnesses for route, middleware, validation, error, and security-boundary behavior.

**Exit checks:** Focused API tests demonstrate that non-loopback, wrong-origin, wrong-Host, and unauthenticated worker requests are rejected; valid local requests work; errors remain safe and consistent.

### Milestone 1.3 — Persistence foundation and API contracts

- Define and migrate the logical entities from the specification: projects, reporting periods, immutable PM update revisions, source inputs, settings versions, capacity aggregates, report runs, reviews, source results, artifacts, and report metrics.
- Add constraints/indexes sufficient for prototype correctness, including unique revision numbers, unique project/week capacity aggregates, and non-overlapping run/claim protection.
- Implement repository/data-access boundaries and transaction handling for immutable revisions, run claiming, and atomic latest-artifact pointer updates.
- Stub the complete browser and worker route shapes from the specification with validated request/response contracts, including explicit not-yet-implemented responses where needed.

**Exit checks:** Migrations create the prototype schema from a clean database; repository tests verify core constraints and revision/snapshot relationships; API contract tests cover paths, payload validation, response shapes, and pagination.

## Phase 2: Frontend setup (UI skeleton, routing)

**Goal:** Establish a navigable React shell that uses only the local API and supports the specified desktop browser baseline.

**Tasks:** T-010 through T-012 in [tasks.md](./tasks.md).

### Milestone 2.1 — Frontend bootstrap and route shell

- Pin the specified React and Vite versions and configure the frontend package and lockfile.
- Add application layout, navigation, route handling, loading/empty/error states, and a shared API client with safe error rendering.
- Bind Vite to `127.0.0.1:5173`; configure API requests to the loopback Express origin without wildcard CORS.
- Add semantic page titles, keyboard-operable navigation, and form accessibility basics.

**Exit checks:** The frontend starts on loopback and navigates to placeholder routes for dashboard, weekly update, source inputs, source readiness, report history/details, and settings. No secret is present in frontend configuration or browser bundles.

### Milestone 2.2 — Screen skeletons and API wiring conventions

- Implement the six screen shells specified in the UI requirements, with shared status, warning, form, table, and confirmation patterns.
- Define route-level loading, no-data, not-configured, stale, partial, validation-error, and generic-error behavior.
- Add frontend component tests and a local smoke test against the backend skeleton.

**Exit checks:** Each screen renders its defined structure and handles empty/error responses without success-shaped fallbacks; keyboard and semantic-label checks pass.

## Phase 3: Feature implementation (one feature at a time)

**Goal:** Deliver complete vertical slices in the following sequence. Each feature includes persistence/API, UI, tests, privacy review, and its acceptance checks before the next feature starts.

**Tasks:** T-013 through T-027 in [tasks.md](./tasks.md).

### Milestone 3.1 — Weekly project-manager update

- Implement reporting-period lookup and immutable PM-update revisions.
- Implement RAG, rationale, narrative fields, required-value validation, explicit empty-list semantics, late-state indication, and revision history.
- Implement PM-template CSV import as an unsaved draft; saving the reviewed draft creates the canonical application update.

**Acceptance gate:** Save, reload, edit, and retrieve distinct revisions for a period. Invalid or incomplete data is rejected with field-level errors. A report snapshot can reference the exact revision.

### Milestone 3.2 — Reporting settings

- Implement versioned settings retrieval/update for aging thresholds, status mappings, source freshness, and Git/Confluence allowlists.
- Require a change reason and explicit local-operator confirmation; reject invalid mappings and values without changing active settings.
- Keep forecast output disabled and credentials outside the settings API.

**Acceptance gate:** Valid settings create an immutable version used by subsequent runs; prior runs retain their original settings version. Validation and settings secrecy tests pass.

### Milestone 3.3 — Controlled CSV ingestion and provenance

- Implement UTF-8 CSV upload handling, 25 MiB limit, metadata and scope validation, strict headers/columns/rows, duplicate detection, and safe errors.
- Implement source-specific contracts for Jira issues/sprints/sprint-scope/worklogs/links/milestones, Git commits, Confluence pages, capacity allocations, and PM templates.
- Enforce source freshness and coverage rules, client-sharing attestation, configured allowlists, and supersession/provenance.
- Aggregate capacity in memory and immediately discard capacity files/person-level rows. Delete rejected temporary uploads immediately; retain accepted non-capacity files no longer than seven days.

**Acceptance gate:** Valid fixtures are accepted with provenance; malformed, stale, out-of-scope, duplicate, oversized, and mismatched fixtures fail safely. Tests confirm capacity identities/rows are not persisted or logged and sharing flags are enforced.

### Milestone 3.4 — Source status and dashboard

- Implement source-input/status APIs and dashboard summary from persisted provenance, coverage, freshness, and warnings.
- Implement source readiness and validation UI, including configured/unconfigured, current/stale, rejected, superseded, and unavailable states.
- Ensure optional missing sources are distinguished from required PM/Jira prerequisites.

**Acceptance gate:** Mixed fixtures render correct statuses and warnings in the dashboard and source views; no raw source contents, local file paths, secrets, or person-level capacity are returned to the browser.

### Milestone 3.5 — Reporting-period, source normalization, and calculations

- Implement reporting-period construction in `America/New_York`, UTC persistence, and DST-aware seven-local-calendar-day boundaries.
- Implement deterministic normalized input models and calculations for issue aging, active sprint committed/completed/remaining points, scope changes, blockers/dependencies, milestone health, worklog actuals, capacity totals, and Git activity.
- Apply status/link mappings, client-shareability rules, source-coverage checks, and partial/unavailable outcomes.
- Keep forecasts and deployment/release measures explicitly unavailable.

**Acceptance gate:** Unit and property/boundary tests cover the defined metric rules, threshold edges, re-add/remove scope history, unknown statuses, missing estimates, DST boundaries, and incomplete coverage. Results are traceable to fixture inputs and versioned settings.

### Milestone 3.6 — Scheduled worker and report generation

- Implement the Python 3.12 worker's authenticated claim, heartbeat, and completion workflow through loopback API endpoints; do not connect the worker directly to PostgreSQL.
- Capture and reuse the exact PM revision, source-input IDs, settings version, and scheduled-period anchor for all retries.
- Implement lease expiry, overlap prevention, bounded transient retries, terminal validation failures, idempotent callbacks, safe failure recording, and rejection of late/duplicate completion.
- Generate the exactly-six-slide PowerPoint, with required available measures, source/freshness warnings, unavailable markers, and client-shareable references only.
- Stage a unique per-run artifact; let the API verify the claim and atomically promote the dated file and update `latest.pptx` only for success/partial outcomes.
- Configure the Windows Scheduled Task for Monday 9:00 a.m. `America/New_York`, running in the signed-in project-manager session with prerequisite checks. Missed runs are not replayed.

**Acceptance gate:** Deterministic worker tests verify period anchoring, retries, lease behavior, source requirements, partial reports, exactly six slides, privacy, output naming, and preservation of existing artifacts on every failure path.

### Milestone 3.7 — Report history, artifact retrieval, and human review

- Implement paginated report history, run detail, source outcomes, metric availability, safe failure details, and artifact download.
- Implement append-only `approved` / `changes_requested` reviews with optional notes; review must not cause retries or distribution.
- Ensure artifact paths are constrained beneath the report directory and that no API endpoint sends or publishes reports.

**Acceptance gate:** The project manager can inspect, retrieve, and review successful/partial reports and inspect failures; invalid IDs, unavailable artifacts, and unsafe paths are rejected. No send/publish control or behavior exists.

## Phase 4: Integration and testing

**Goal:** Validate the full workflow and operational guarantees across the React app, Express API, PostgreSQL, filesystem, Windows secrets, and scheduled Python worker.

**Tasks:** T-028 through T-031 in [tasks.md](./tasks.md).

### Milestone 4.1 — End-to-end workflow integration

- Run the full local stack using deterministic CSV fixtures and a controlled trigger clock.
- Verify update entry/import → source upload/validation → source readiness → scheduled claim → calculations → PowerPoint → history/download → review.
- Verify required-input failure and optional-source partial-report paths, including user-visible warnings and retained provenance.

**Exit checks:** End-to-end scenarios pass for both a complete report and a partial report; PM updates and all source/settings snapshots match the run record.

### Milestone 4.2 — Security, privacy, and failure-path verification

- Test loopback-only binding, origin/Host validation, worker token handling, request limits, CSV/path validation, safe errors/logs, ACLs, and secret-store retrieval.
- Inspect generated decks, API payloads, database records, logs, temporary files, and browser assets for credentials, unnecessary personal data, and non-shareable content.
- Inject failures during database access, worker execution, API timeout, lease expiry, artifact staging/promotion, and retention cleanup.

**Exit checks:** Security/privacy tests pass; no prohibited data is persisted or exposed; failed runs never replace the previous valid report or latest pointer; temporary/rejected/capacity inputs follow deletion rules.

### Milestone 4.3 — Operations, retention, and acceptance

- Verify Windows startup wrapper and Task Scheduler setup, Monday schedule, signed-in-session prerequisites, missed-run behavior, and credential rotation/retrieval procedures.
- Verify daily retention cleanup for source files, report records, metrics, capacity aggregates, logs, dated reports, and the latest pointer/copy.
- Run the full automated test suite, type/lint/build checks, and a final six-slide PowerPoint inspection on the supported Windows/Edge baseline.
- Prepare an operator runbook using non-secret setup and recovery instructions; do not document or print credential values.

**Exit checks:** The complete acceptance suite passes; all specification success criteria are demonstrated; the documented local startup, weekly run, review, and retention operations work without remote exposure or automatic distribution.

## Milestone dependency order

`1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 → 4.1 → 4.2 → 4.3`

An exit check is a gate, not a calendar estimate. If a security-policy prerequisite is unapproved or a milestone fails its checks, pause dependent work, record the blocker, and resolve it before proceeding.
