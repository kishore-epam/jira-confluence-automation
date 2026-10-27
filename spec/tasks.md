# Implementation Tasks: USF-PLAN Weekly Status Reporting Platform

## How to use this task list

Tasks are sequenced by the phases in [plan.md](./plan.md). Each task has a title, description, testable acceptance criteria, and explicit task dependencies. A task may start only when its dependencies are complete. Phase 3 tasks are vertical feature slices: complete the criteria and tests for each task before beginning the next slice. The task list describes intended implementation; it does not claim that any task is complete.

## Phase 1: Backend setup (database, API skeleton)

### T-001 - Confirm local security prerequisites

**Description:** Verify the dedicated, non-shared Windows account, approval of Windows Credential Manager for this prototype, and restricted Docker access. Record only the approval/status, never credentials. Stop secret-dependent work if approval is missing.

**Acceptance criteria:**
- The project runs under a dedicated Windows account that is not shared with other users.
- Windows Credential Manager approval is confirmed, or the task is explicitly blocked pending an approved alternative.
- Docker access is restricted to the dedicated project-manager account and machine administrators.
- No secret values appear in task records, source files, command history, or logs.

**Dependencies:** None.

### T-002 - Pin backend runtime and package dependencies

**Description:** Establish the Node.js backend package using the specified runtime, engine constraint, dependency versions, and committed lockfile.

**Acceptance criteria:**
- `.nvmrc` contains `24.22.1`; the backend package declares the Node 24 engine line.
- Express is pinned to `5.3.0` and dependency versions are reproducible from the committed lockfile.
- A clean `npm ci` succeeds on the supported Windows environment, and `npm ls --depth=0` reports the pinned Express dependency without errors.
- The backend package's Node.js and Express versions match the specified values. HTTP server startup and `/healthz` verification are performed in T-005 after the Express application entry point exists.
- No credentials or machine-specific secret values are added to tracked files.

**Dependencies:** T-001.

### T-003 - Configure local PostgreSQL service

**Description:** Add the PostgreSQL-only Docker Compose service and a safe local startup path.

**Acceptance criteria:**
- `docker-compose.yml` runs only the official `postgres:15` image with a named data volume.
- The database port is bound only to `127.0.0.1:5432`.
- `scripts/start-local-database.ps1` retrieves the PostgreSQL username/password from the Windows Credential Manager Generic Credential target `USF-PLAN/PostgreSQL` and passes them to the local Compose process without `.env` files, committed defaults, shell-history writes, command-line password arguments, or logging values.
- PostgreSQL starts, persists data in its named volume, and is reachable only through loopback.

**Dependencies:** T-001.

### T-004 - Create protected local data directories

**Description:** Establish input, report, and log directories and apply the local filesystem access restrictions required for project data.

**Acceptance criteria:**
- Required directories exist and are outside tracked source files unless an explicitly non-secret example is intended.
- Windows ACLs grant access only to the dedicated project-manager account, SYSTEM, and local Administrators.
- A verification procedure confirms the effective ACLs without printing sensitive file contents.
- Non-secret directory configuration is documented for the API and worker.

**Dependencies:** T-001.

### T-005 - Implement Express application skeleton

**Description:** Create the Express application structure, versioned router registration, configuration loading, startup checks, and safe health endpoint.

**Acceptance criteria:**
- The API binds to `127.0.0.1:3000` by default and rejects non-loopback connections.
- `GET /healthz` reports only API and database readiness, without versions, paths, configuration, or secrets.
- Missing/invalid startup configuration causes a clear startup failure rather than a success-shaped fallback.
- A focused test confirms healthy and unavailable-database health responses.

**Dependencies:** T-002, T-003.

### T-006 - Add API validation, error, and logging middleware

**Description:** Implement common request validation, request-size controls, correlation IDs, safe error responses, and privacy-conscious operational logging.

**Acceptance criteria:**
- Malformed requests, invalid fields, missing resources, conflicts, oversized uploads, invalid worker credentials, and unexpected errors use the specified HTTP status classes and safe response shape.
- Invalid field details do not include uploaded content, secrets, or unnecessary personal data.
- Unexpected errors return a correlation ID and a generic message; internal details are logged only when safe.
- Logs include operational event/time data without credentials or unnecessary personal information.

**Dependencies:** T-005.

### T-007 - Enforce browser and worker trust boundaries

**Description:** Add exact-origin, Host, loopback, and worker bearer-token protections for the API boundary.

**Acceptance criteria:**
- Browser requests are accepted only from `http://127.0.0.1:5173` and an allowed loopback Host; wildcard CORS is not enabled.
- State-changing browser requests require the expected Origin and non-loopback connections are rejected.
- Internal worker endpoints require a valid bearer token loaded from Windows Credential Manager; absent/invalid tokens are rejected.
- The worker token is never exposed to browser code, returned by an endpoint, persisted in PostgreSQL, or logged.
- Automated tests cover accepted local requests and rejection of wrong origin, wrong Host, non-loopback, and invalid worker-token cases.

**Dependencies:** T-001, T-005, T-006.

### T-008 - Create database schema and migrations

**Description:** Implement the logical entities and relationships required by the specification using repeatable PostgreSQL migrations.

**Acceptance criteria:**
- Migrations create the project, reporting period, PM update, source input, settings version, capacity aggregate, report run, review, source result, artifact, and metric records.
- Constraints support immutable revision ordering, unique project/week capacity aggregates, report-run/source provenance, and safe run claiming.
- A clean database can be migrated to the current schema, and migration tests pass.
- Passwords, tokens, private keys, raw capacity rows, and PowerPoint bytes are not stored in the database.

**Dependencies:** T-003, T-005.

### T-009 - Define API contracts and persistence access layer

**Description:** Implement repository/data-access boundaries and route contracts for browser and worker APIs, including safe stubs for features not yet implemented.

**Acceptance criteria:**
- Browser and worker routes match the paths and request/response semantics in `specification.md`.
- Validation is performed at route boundaries and repository functions use parameterized database operations.
- List APIs default to 50 records and never return more than 100 per page using opaque cursors.
- Transactions protect immutable revisions, worker claims, and latest-artifact pointer updates.
- Contract tests cover payload validation, response shapes, pagination, and explicit not-yet-implemented behavior.

**Dependencies:** T-006, T-007, T-008.

## Phase 2: Frontend setup (UI skeleton, routing)

### T-010 - Bootstrap React and Vite frontend

**Description:** Create the React 18.3.1/Vite 7.3.7 frontend package and safe local development configuration.

**Acceptance criteria:**
- The frontend dependencies match the specified versions and are reproducible from a committed lockfile.
- Vite binds to `127.0.0.1:5173`.
- The browser bundle and frontend configuration contain no database credential, worker token, or other secret.
- The frontend can start independently and load a basic application shell.

**Dependencies:** T-001.

### T-011 - Add frontend routing and shared API client

**Description:** Implement navigation, route handling, a typed/shared API client, and consistent loading, empty, validation-error, and generic-error states.

**Acceptance criteria:**
- Routes exist for dashboard, weekly update, source inputs, source readiness, report history/details, and settings.
- API requests target the loopback Express origin and do not weaken the exact-origin policy.
- API errors render actionable safe messages and are not converted into success-shaped fallbacks.
- Navigation and page structure are keyboard-operable and use semantic labels.

**Dependencies:** T-005, T-009, T-010.

### T-012 - Implement screen skeletons and frontend tests

**Description:** Build the six specified screen shells and shared visual patterns before adding feature behavior.

**Acceptance criteria:**
- Dashboard, update, upload/validation, source readiness, report history/details, and settings screens render their specified primary content regions.
- Each screen renders loading, empty, unavailable, stale/partial, validation-error, and generic-error states as applicable.
- Component tests cover navigation, safe errors, and empty data.
- A local smoke test confirms the UI can call the API skeleton without wildcard CORS.

**Dependencies:** T-011.

## Phase 3: Feature implementation (one feature at a time)

### T-013 - Implement reporting periods and PM update revisions

**Description:** Implement period lookup, PM narrative editing, validation, immutable revisions, and late-state behavior.

**Acceptance criteria:**
- A period is identified using the specified `America/New_York` rules and stored with UTC boundaries.
- RAG status/rationale are mandatory; required narrative fields must be present, while explicitly empty lists are valid.
- Saving an edit creates a new revision; earlier revisions remain unchanged and can be retrieved.
- The API returns field-level validation errors and the UI displays late status without silently changing narrative content.
- Tests cover create/read/edit/revision and boundary/deadline behavior.

**Dependencies:** T-008, T-009, T-012.

### T-014 - Implement PM-template CSV draft import

**Description:** Parse the supported one-row PM-template CSV and populate the weekly update form as an unsaved draft.

**Acceptance criteria:**
- Only the specified UTF-8 CSV schema and list delimiter are accepted.
- A period mismatch or invalid field returns safe field-level errors and leaves saved updates unchanged.
- Imported content remains unsaved until the project manager reviews and confirms save.
- The saved application update, not the CSV, is the canonical report narrative.

**Dependencies:** T-013.

### T-015 - Implement versioned reporting settings

**Description:** Add settings UI/API for issue-aging thresholds, status mappings, source freshness, and Git/Confluence allowlists.

**Acceptance criteria:**
- Settings updates require a 1-500 character change reason and explicit confirmation.
- Each accepted update creates an immutable version; prior report runs retain their referenced settings version.
- Invalid thresholds/mappings are rejected without changing active settings.
- Forecast calculation remains disabled and no credential is accepted or displayed.
- Tests verify persistence, validation, version selection, and secret exclusion.

**Dependencies:** T-008, T-009, T-012.

### T-016 - Implement secure CSV upload framework

**Description:** Implement multipart upload handling, upload metadata, size/type checks, temporary-file lifecycle, and a common validation result model.

**Acceptance criteria:**
- Only UTF-8 CSV files up to 25 MiB are accepted; malformed CSV, path-like filenames, unknown fields, and invalid metadata are rejected.
- Upload metadata includes extraction time, coverage range, and project key with the specified timestamp formats.
- Errors identify the source/field safely and never echo file contents or sensitive values.
- Rejected and temporary files are deleted immediately after validation.
- Tests cover size boundaries, encoding, malformed CSV, metadata, unsafe names, and cleanup paths.

**Dependencies:** T-004, T-006, T-008, T-009, T-014.

### T-017 - Implement Jira CSV contracts

**Description:** Validate Jira issues, sprints, sprint-scope intervals, and required identifiers against their specified schemas.

**Acceptance criteria:**
- Required Jira columns, values, active sprint count, project scope, timestamps, status mappings, and estimates are validated.
- Issue status/category mismatches, duplicate identifiers, overlapping membership intervals, and incomplete required coverage are rejected or marked incomplete as specified.
- `client_shareable` values are boolean assertions and issue/milestone uploads require sharing attestation.
- Tests cover valid/invalid fixtures, active sprint cardinality, duplicate keys, scope history, and status mappings.

**Dependencies:** T-015, T-016.

### T-018 - Implement optional-source CSV contracts

**Description:** Validate Jira worklogs/issue links/milestones, Git commits, Confluence pages, and capacity allocations.

**Acceptance criteria:**
- Each dataset enforces its required columns, identifier uniqueness/deduplication behavior, timestamps, numeric constraints, and configured scope allowlists.
- Confluence URLs are restricted to the configured host/project-space path and exclude credentials, query, and fragment.
- Jira milestone and Confluence uploads require client-sharing attestation; only shareable rows can appear by name/reference.
- Capacity rows are aggregated in memory, duplicate person/week rows are detected, and person identifiers/hours are discarded immediately.
- Tests confirm invalid records fail safely and capacity identities/rows never reach persistence or logs.

**Dependencies:** T-015, T-016.

### T-019 - Implement source provenance, freshness, and retention

**Description:** Persist accepted input metadata/hashes and supersession relationships; enforce coverage/freshness and source retention.

**Acceptance criteria:**
- Accepted source records track source type/dataset, period, extraction/receipt time, coverage, validation, safe summary, content hash, attestation, and superseded input.
- Current/stale status follows the seven-calendar-day threshold and required coverage rules; stale values are never silently selected.
- Accepted non-capacity files are access-controlled and deleted within seven calendar days; capacity files are deleted immediately.
- Report runs can reference exact source-input IDs even after raw-file retention ends.
- Tests cover freshness boundaries, coverage gaps, supersession, deletion deadlines, and provenance.

**Dependencies:** T-017, T-018.

### T-020 - Implement dashboard and source-readiness views

**Description:** Connect the dashboard, source input, validation, and source readiness screens to persisted source and period data.

**Acceptance criteria:**
- The UI displays PM deadline/completion, latest run state, per-source configuration, freshness, coverage, and actionable warnings.
- Required PM/Jira inputs are distinguished from optional sources that can yield a partial report.
- Browser responses contain no raw source contents, local file paths, secrets, or person-level capacity information.
- Tests cover current, stale, rejected, missing, superseded, optional, and required-source states.

**Dependencies:** T-013, T-019, T-012.

### T-021 - Implement reporting-window and metric calculations

**Description:** Implement pure/testable calculations for period boundaries, aging, sprint progress, scope changes, blockers, milestones, worklogs, capacity, and Git activity.

**Acceptance criteria:**
- Period boundaries are seven local calendar days in `America/New_York`, including correct 167/169-hour DST cases, with UTC persistence and display.
- Issue-age thresholds, sprint baseline/completion/remaining rules, scope changes, blocker mapping, milestone health, worklog interval, weekly capacity, and Git commit rules match the spec.
- Unknown mappings, incomplete history, missing estimates, and missing optional inputs produce explicit partial/unavailable outcomes rather than fabricated values.
- Planned capacity and worklog actuals are kept distinct; person-level capacity is never persisted or displayed.
- Unit and boundary tests cover threshold edges, DST transitions, re-add/remove intervals, unknown status, and incomplete coverage.

**Dependencies:** T-015, T-017, T-018, T-019.

### T-022 - Implement scheduled report-run lifecycle API

**Description:** Implement worker claim, heartbeat, completion, lease expiry, retry association, and immutable run-input snapshot handling.

**Acceptance criteria:**
- A claim is atomic and captures period anchor, PM revision, source IDs, and settings version.
- At most one active worker claim exists; heartbeat/lease timing follows the specified 60-second heartbeat and five-minute expiry.
- Retry limits/delays and same-snapshot behavior are enforced; validation failures are terminal.
- Completion is idempotent and late/duplicate/expired claims cannot update a newer run or artifact.
- Worker routes require the bearer token and tests cover concurrency, timeout, retry, and authentication behavior.

**Dependencies:** T-007, T-008, T-009, T-013, T-015, T-019.

### T-023 - Generate six-slide PowerPoint artifacts

**Description:** Implement deterministic report composition and PowerPoint generation from a captured report snapshot.

**Acceptance criteria:**
- Output contains exactly six slides in the specified order and all required available measures/narratives.
- Missing, stale, partial, and unavailable data are clearly identified; forecasts and unsupported deployment/release content are unavailable and not fabricated.
- Only `client_shareable` Jira/Confluence details appear; capacity is aggregate only.
- Output naming uses the report-end local date and the deck is readable in the supported presentation environment.
- Fixture tests assert six slides, required content, source warnings, no forbidden data, and deterministic output properties.

**Dependencies:** T-014, T-017, T-018, T-021.

### T-024 - Implement safe artifact promotion and retention

**Description:** Stage per-run report files, promote successful/partial outputs atomically, maintain `latest.pptx`, and enforce artifact retention.

**Acceptance criteria:**
- A worker writes to a unique per-run staging path beneath the report directory and cannot overwrite a final artifact.
- The API validates the active claim and path containment before promotion.
- Successful/partial completion atomically registers the dated artifact and updates `latest.pptx` plus the project pointer.
- Failed, late, or duplicate runs leave the previous dated and latest artifacts unchanged.
- Daily cleanup removes dated artifacts and the latest copy/pointer at the one-year deadline; failure-injection tests cover promotion and cleanup.

**Dependencies:** T-004, T-008, T-022, T-023.

### T-025 - Configure Windows scheduled worker execution

**Description:** Add the Windows startup wrapper and Task Scheduler configuration for the API/database startup and weekly worker run.

**Acceptance criteria:**
- The API task starts PostgreSQL and Express at user logon; the Vite UI starts on demand.
- The worker runs each Monday at 9:00 a.m. `America/New_York` in the signed-in project-manager session.
- The task retrieves secrets from Windows Credential Manager, verifies Docker/API/input prerequisites, and fails safely when prerequisites are unavailable.
- A missed trigger is not replayed; the worker uses the scheduled trigger time as its reporting-period anchor.
- Setup and operational verification are documented without secret values.

**Dependencies:** T-003, T-005, T-007, T-022, T-024.

### T-026 - Implement report history and artifact retrieval

**Description:** Implement paginated history, run detail, source/metric/failure status, and local PowerPoint retrieval.

**Acceptance criteria:**
- History displays period, status, completion time, warnings, and artifact availability with the specified pagination limits.
- Run details identify reporting boundaries, source results, unavailable metrics, safe failure details, and prior-success preservation.
- Artifact retrieval is limited to completed artifacts beneath the report directory and does not publish or distribute them.
- Tests cover pagination, missing IDs, failed runs, path traversal attempts, and artifact access.

**Dependencies:** T-009, T-022, T-024.

### T-027 - Implement append-only report review

**Description:** Add explicit approval/changes-requested review recording and UI.

**Acceptance criteria:**
- A project manager can submit `approved` or `changes_requested` with an optional note up to 2,000 characters for a completed/partial report.
- Each decision is appended with timestamp and local actor label; the latest decision is displayed as current.
- Review does not modify the artifact, trigger another run, or distribute the report.
- No send, publish, or automatic distribution action is exposed.
- Tests cover validation, append-only history, and no-side-effect behavior.

**Dependencies:** T-026.

## Phase 4: Integration and testing

### T-028 - Verify complete and partial end-to-end workflows

**Description:** Exercise the complete local workflow from PM narrative and CSV inputs through report review using deterministic fixtures and a controlled scheduled trigger.

**Acceptance criteria:**
- A complete-input scenario produces a successful six-slide report and matching run/source/settings snapshot.
- A missing optional-source scenario produces a partial report with visible warnings and unavailable measures.
- Missing/invalid PM or required Jira input produces a failed run and preserves the prior successful artifact.
- The project manager can inspect, retrieve, and review the generated artifact.
- End-to-end tests pass on the supported local stack.

**Dependencies:** T-020, T-021, T-023, T-025, T-027.

### T-029 - Verify security, privacy, and failure paths

**Description:** Run focused security/privacy tests and inject failures across the API, database, worker, uploads, filesystem, and secrets boundary.

**Acceptance criteria:**
- Loopback, Origin/Host, worker-token, request-size, CSV/path, ACL, and safe-error tests pass.
- Inspection confirms no credentials, unnecessary personal data, unshareable source details, or person-level capacity appear in browser bundles, API responses, logs, database records, or reports.
- Database outages, worker/API timeouts, expired leases, artifact-write failures, and cleanup errors surface explicit safe failures.
- No failure path replaces the prior successful report or latest pointer.

**Dependencies:** T-028.

### T-030 - Verify retention and operational procedures

**Description:** Validate daily retention behavior, local startup, weekly scheduling, prerequisite handling, and operator procedures.

**Acceptance criteria:**
- Accepted non-capacity source files, rejected uploads, capacity inputs, metadata, records, logs, aggregates, dated reports, and latest copies follow their specified retention/deletion rules.
- Windows startup and scheduled tasks work in the signed-in session and remain loopback-only.
- Operators can verify credential retrieval, task health, report status, and safe recovery without displaying or recording credential values.
- Retention and operations tests pass with a controllable clock or bounded test fixtures.

**Dependencies:** T-004, T-019, T-024, T-025, T-028, T-029.

### T-031 - Run final acceptance and record release readiness

**Description:** Execute full project validation and demonstrate the specification success criteria on the supported Windows/Microsoft Edge baseline.

**Acceptance criteria:**
- Full automated tests, lint, type checks, and frontend/backend builds pass.
- All measurable success criteria in `specification.md` have test evidence or an explicitly recorded blocker.
- The final PowerPoint is verified to have exactly six slides and is readable.
- A non-secret operator runbook covers startup, scheduled operation, report review, retention, and supported limitations.
- Release readiness is recorded only after all blockers are resolved; no production/remote claims are made for the prototype.

**Dependencies:** T-028, T-029, T-030.

## Dependency summary

- T-001 is the prerequisite for local secrets and environment setup.
- Phase 1 establishes the runtime, database, security middleware, persistence, and API contracts before the UI and features.
- Phase 2 provides the route/screen shell used by the feature slices.
- Phase 3 proceeds from PM updates/settings to ingestion, calculations, report generation, retrieval, and review.
- Phase 4 validates integrated behavior, security/privacy, retention, and final acceptance after feature tasks pass.
