# Implementation Task Analysis

## Scope and method

Reviewed all tasks in [tasks.md](./tasks.md) against the product requirements and API/data contracts in [specification.md](./specification.md), the phase ordering in [plan.md](./plan.md), and the principles in [constitution.md](./constitution.md).

Complexity estimates describe implementation effort: **Low**, **Medium**, or **High**. Risk reflects the likely impact of failure or the sensitivity of the work, not task difficulty. Dependencies below reproduce the task list; dependency and cross-document findings follow the task table. No task is marked complete by this analysis.

## Task-by-task assessment

| Task | Complexity | Risk | Dependencies | Assessment |
|---|---|---|---|---|
| T-001 — Confirm local security prerequisites | Low | High | None | A small verification task, but credential-store approval and Windows-account exclusivity are external prerequisites. Local inspection alone cannot prove organizational policy approval or that an account is not shared. |
| T-002 — Pin backend runtime and package dependencies | Low | Low | T-001 | Narrow setup task with reproducible version/lockfile checks. Low-risk and valuable early, but backend package manifests/lockfile location should be named. |
| T-003 — Configure local PostgreSQL service | Medium | High | T-001 | Compose setup is moderate; secret injection, Docker ACL restrictions, and persistent-volume behavior are high-impact. Verify the supported Docker Desktop environment and never print credential values. |
| T-004 — Create protected local data directories | Medium | High | T-001 | Windows ACLs and data-retention locations need careful verification. The plan should specify whether paths are user-profile or repository-external and how ACL inheritance is handled. |
| T-005 — Implement Express application skeleton | Medium | Medium | T-002, T-003 | Depends on both runtime and database readiness. Health checks need a clear readiness contract and tests for database-unavailable behavior. |
| T-006 — Add API validation, error, and logging middleware | Medium | High | T-005 | Cross-cutting behavior affects every endpoint. Validate that logs redact values by design and that correlation IDs cannot be used to leak internal error details. |
| T-007 — Enforce browser and worker trust boundaries | High | High | T-001, T-005, T-006 | High consequence and platform-sensitive: loopback/Host/Origin checks and token provisioning need integration tests. Browser origin checks are not a substitute for the dedicated-account and local-network boundary. |
| T-008 — Create database schema and migrations | High | High | T-003, T-005 | Broad logical model with retention and immutable-history requirements. Test clean installation, constraints, and deletion behavior before relying on the schema. |
| T-009 — Define API contracts and persistence access layer | High | High | T-006, T-007, T-008 | Large cross-cutting surface. “Safe stubs” should be unambiguously non-successful for unimplemented functionality and must not imply data has been saved. |
| T-010 — Bootstrap React and Vite frontend | Low | Low | T-001 | A low-risk, high-gain standalone setup slice; it can proceed in parallel with T-002–T-004 after T-001, despite the plan's strictly sequential phase headings. |
| T-011 — Add frontend routing and shared API client | Medium | Medium | T-005, T-009, T-010 | Requires the API contract and frontend shell. Ensure response/error types reflect the documented API and no secrets enter Vite environment variables. |
| T-012 — Implement screen skeletons and frontend tests | Medium | Low | T-011 | Good early usability feedback. Cover all six screens and accessible states without implementing workflows prematurely. |
| T-013 — Implement reporting periods and PM update revisions | High | High | T-008, T-009, T-012 | High-value core workflow; immutable revisions and DST-aware period rules require explicit tests and transactional persistence. |
| T-014 — Implement PM-template CSV draft import | Medium | Medium | T-013 | Useful migration path from the existing template. It needs the upload/parser infrastructure and must preserve the unsaved-draft/canonical-update rule. The current task graph does not list the upload-framework dependency. |
| T-015 — Implement versioned reporting settings | Medium | High | T-008, T-009, T-012 | Configuration changes affect all future calculations. Validate ranges/mappings, version immutability, and that secrets cannot be submitted. |
| T-016 — Implement secure CSV upload framework | High | High | T-004, T-006, T-008, T-009, T-014 | Security-sensitive shared input surface. Its listed dependency on T-014 is backwards: the PM CSV import needs this infrastructure, creating an ordering cycle if T-014 is corrected to depend on T-016. |
| T-017 — Implement Jira CSV contracts | High | High | T-015, T-016 | Required inputs determine whether a report can run. Strict schema, mappings, client-shareability, coverage, and event-history checks need comprehensive positive/negative fixtures. |
| T-018 — Implement optional-source CSV contracts | High | High | T-015, T-016 | Multiple schemas and privacy requirements, especially immediate capacity aggregation/discard and URL allowlisting, merit isolated tests per source type. |
| T-019 — Implement source provenance, freshness, and retention | High | High | T-017, T-018 | Controls input selection and deletion lifecycles. Define deterministic boundary behavior for “no more than seven days” and test cleanup failures. |
| T-020 — Implement dashboard and source-readiness views | Medium | Medium | T-013, T-019, T-012 | High visibility and moderate effort. Depends on real source status contracts and must distinguish required blockers from optional partial-report sources. |
| T-021 — Implement reporting-window and metric calculations | High | High | T-015, T-017, T-018, T-019 | Core correctness risk. Pure calculation modules, fixed-clock fixtures, DST cases, scope interval edge cases, and partial-data states should be tested independently. |
| T-022 — Implement scheduled report-run lifecycle API | High | High | T-007, T-008, T-009, T-013, T-015, T-019 | Concurrency, leases, retries, snapshot consistency, and idempotence are high risk. Test simultaneous claims and late callbacks against a real test database. |
| T-023 — Generate six-slide PowerPoint artifacts | High | High | T-014, T-017, T-018, T-021 | Output correctness and disclosure risk. Add artifact-level assertions for slide count, required content, shareability, and prohibited data. |
| T-024 — Implement safe artifact promotion and retention | High | High | T-004, T-008, T-022, T-023 | Filesystem atomicity and cleanup can destroy the last good output if mishandled. Use per-run staging, failure injection, path containment, and retention tests. |
| T-025 — Configure Windows scheduled worker execution | Medium | High | T-003, T-005, T-007, T-022, T-024 | Windows session, DST, credential retrieval, and missed-run rules create operational risk. Validate task principal, run conditions, and actual task behavior on the target machine. |
| T-026 — Implement report history and artifact retrieval | Medium | High | T-009, T-022, T-024 | Exposes sensitive report content and local files. Enforce artifact path containment and verify access/error behavior end to end. |
| T-027 — Implement append-only report review | Medium | Medium | T-026 | Small workflow, but append-only history and no side effects matter. Ensure review does not modify, publish, or trigger report runs. |
| T-028 — Verify complete and partial end-to-end workflows | High | High | T-020, T-021, T-023, T-025, T-027 | Valuable system-level acceptance, but late discovery here is expensive. Keep focused integration checks running at the end of each preceding vertical slice. |
| T-029 — Verify security, privacy, and failure paths | High | High | T-028 | Essential final audit, but security/privacy checks must also run continuously within T-003, T-006–T-009, T-016–T-024; deferring all checks until after E2E increases rework risk. |
| T-030 — Verify retention and operational procedures | Medium | High | T-004, T-019, T-024, T-025, T-028, T-029 | Operational acceptance depends on implemented deletion and scheduling behavior. Test time-based cleanup without relying on real retention waits. |
| T-031 — Run final acceptance and record release readiness | Medium | High | T-028, T-029, T-030 | Release gate should be evidence-based; list exact test/build commands in the eventual runbook and do not claim remote/production readiness. |

## Gaps, contradictions, and missing artifacts

| ID | Finding | Impact | Recommended resolution |
|---|---|---|---|
| A-01 | **T-014/T-016 dependency is reversed.** T-016 currently depends on T-014, while T-014 needs CSV upload/parsing infrastructure. | A literal execution order either implements duplicate upload logic or blocks the import. Reversing the dependency without changing the existing edge creates a cycle. | Reorder or split the tasks so shared upload framework precedes PM-template import. Remove T-014 from T-016 dependencies; make PM import depend on the upload framework. Update the plan's Phase 3 ordering and dependency chain to match. |
| A-02 | **T-001's acceptance evidence is not obtainable from local inspection alone.** Account exclusivity and organizational approval of Credential Manager require an accountable human/policy confirmation. | A task could be falsely marked complete from a username/group check, causing secret handling to proceed without approval. | Record separate non-secret confirmations: user confirms the Windows account is dedicated; organization/policy owner confirms secret-store approval. Local account/group inspection can support, but not replace, those attestations. If either is absent, mark T-001 blocked and stop credential-dependent tasks. |
| A-03 | **Task 1 cannot authorize or prove Docker access restrictions by itself.** Docker access is controlled by Windows groups/daemon configuration and must be checked on the actual machine. | Compose credentials could be visible to another local Docker user despite loopback port binding. | Define a read-only account/group verification procedure, have the owner confirm exclusivity, and document remediation as a separate approved administration action if access is broader than allowed. Do not change group membership without authorization. |
| A-04 | **Backend/frontend paths and startup artifacts are not specified at task level.** The repo skeleton has `backend/`, `frontend/`, and root `docker-compose.yml`, but tasks do not explicitly bind package manifests/configuration to those paths. | Implementations may diverge from the agreed skeleton or duplicate package/config files. | State expected paths in T-002/T-003/T-005/T-010 and identify the exact startup wrapper/config example filenames in the implementation design. |
| A-05 | **The operator runbook is deferred to T-031.** Earlier tasks require startup, ACL verification, secret retrieval, and Task Scheduler setup documentation. | The environment may become difficult to reproduce before the final milestone; security-sensitive setup may be performed inconsistently. | Create/update a concise non-secret operator guide alongside T-001/T-003/T-025, then finalize it in T-031. Do not include credential values. |
| A-06 | **Security/privacy verification is overly back-loaded in T-029.** Many earlier high-risk tasks need focused negative tests. | A late audit may force expensive architectural rework. | Treat security/privacy acceptance tests as part of each task (already partly stated) and run a lightweight boundary smoke suite continuously; keep T-029 as an integrated final check. |
| A-07 | **T-004's ACL acceptance is platform-dependent and path-dependent.** It does not specify ACL inheritance, data root, or behavior when the chosen directory is on an unsupported filesystem. | Access restrictions may be asserted but not effective for Docker volumes or worker files. | Specify the local data root, inheritance policy, verification command/output expectations, and a fail-closed behavior if ACL application/verification fails. |
| A-08 | **The spec retains a forecast requirement in FR-008/SC-009 while prototype forecast calculation is out of scope and disabled.** | Developers may interpret conditional forecast language as permission to implement forecasts or configure the threshold. | Add a clear precedence note: FR-008/SC-009 describe future behavior only; in this prototype SC-010 and the out-of-scope decision govern, and forecasts are always unavailable. |
| A-09 | **The reporting interval is described both as the immediately preceding seven days ending at trigger and as seven local calendar days.** These agree in local wall time, but the phrase “exactly preceding seven days” can be mistaken for 168 elapsed hours across DST. | DST-week calculations and worklog coverage can be inconsistent. | Use the explicit local-calendar boundary definition as canonical everywhere, including user-story acceptance text and the report-period display. |
| A-10 | **Constitution and detailed spec differ on named hours and approval.** Constitution allows a possible future approval exception; the updated specification prohibits named capacity for this prototype and requires a separately approved specification change. | A developer might treat a runtime approval flag as sufficient. | Align constitution wording with the specification: no named planned/actual hours in this prototype; future changes require a specification change, not an in-app approval toggle. |
| A-11 | **Task plans do not identify deliverable artifacts for testing and operations.** Fixture catalogs, API contract examples, database migration tests, Windows task registration procedure, and generated report inspection evidence are referenced but not named. | Acceptance criteria may be difficult to reproduce or audit. | Add test/fixture locations and runbook/task-registration artifacts when repository conventions are confirmed; keep secrets and person-level examples out of fixtures. |
| A-12 | **The final commit instruction supplied by the user is sentence-like and may be unsuitable as a conventional commit subject.** | Commit subject choice may be ambiguous when the user asks for descriptive commits. | Before committing implementation work, use the requested exact message only if the user confirms that exact subject is desired; otherwise use a concise descriptive subject and retain the user's approval separately. |
| A-13 | **T-002 required a backend startup check before T-005 creates the Express application entry point.** | T-002 could not meet its clean backend-startup criterion in its dependency position without duplicating T-005 or creating misleading success behavior. | **Resolved for T-002:** its acceptance criteria now validate the clean install, package graph, and pinned versions; HTTP server startup and `/healthz` are deferred to T-005. |
| A-14 | **T-023 depends on T-014, the optional PM-template CSV import, even though report generation uses the canonical saved PM update.** | This delays the P1 report path behind an optional P2 import and violates low-risk/high-gain sequencing. | Make report generation depend on T-013 (saved PM update) rather than T-014. Keep PM-template import independently testable as a convenience input path. |
| A-15 | **The spec and T-003 do not name the Windows Credential Manager record identifier or the operator provisioning procedure.** | The startup wrapper and runtime test cannot reliably agree on which credential to retrieve, and adding a password through command-line arguments would expose it. | Select/document a non-secret Generic Credential target name and safe provisioning steps. Provision credentials outside the agent session; have the wrapper retrieve them without echoing values or placing them in command arguments/logs. |

## Low-risk, high-gain ordering review

“Low risk, high gain” is applied only among tasks whose prerequisites are satisfied; it does not override security or correctness gates.

1. **T-001 first as a gating verification, not as permission inferred by the agent.** It is low implementation effort, but high risk if falsely passed. Obtain the human/policy confirmations; otherwise block credential-dependent work.
2. **After T-001, begin the low-risk, high-gain foundations in parallel where practical:** T-002 (runtime pinning), T-003 (Compose/database setup), T-004 (protected directories), and T-010 (frontend bootstrap). T-003/T-004 remain security-sensitive despite modest scope and need explicit checks.
3. **Then build shared foundations in dependency order:** T-005 → T-006 → T-007, with T-008 following database/API startup; complete T-009 once middleware, security boundaries, and schema are ready. Keep T-010/T-011/T-012 progressing against the contract as soon as available rather than waiting unnecessarily for all backend feature work.
4. **Before Phase 3 proceeds, repair A-01's T-014/T-016 ordering.** Then complete PM updates and settings, CSV infrastructure/contracts, provenance, source status, calculations, report lifecycle/generation, artifacts, scheduling, history, and review in dependency order.
5. **Shift focused tests left.** Run each task's acceptance tests immediately, including security/privacy negatives for each risky boundary; reserve T-028–T-031 for integrated confirmation, not first discovery of defects.

This order surfaces low-cost environment and frontend feedback early while preserving the dedicated-account/secret-store gates and keeping every feature behind its actual dependencies.

## Task 1 approval checkpoint

T-001 is a verification task only. The proposed work is:

1. Inspect the current Windows account name and group memberships using read-only commands; do not inspect or reveal Credential Manager entries.
2. Ask the project owner to confirm that this account is dedicated/non-shared and that organizational policy approves Windows Credential Manager for this prototype. A local command cannot establish either fact.
3. Inspect Docker access configuration/group membership without changing it. Report only whether the allowed-account condition is verifiable; do not add/remove users or alter Docker settings.
4. Record non-secret status only: **passed**, **blocked pending policy/account confirmation**, or **blocked pending Docker access remediation**. Do not put credentials in the analysis or task records.

### Task 1 verification outcome

The user approved the read-only verification plan, confirmed that Windows Credential Manager is approved by organizational policy, first stated that the account was not dedicated, and then clarified that the Windows account is dedicated. The latter clarification is treated as the corrected confirmation.

Read-only checks were then performed:

- The `docker-users` local group exists and has one member; the current account is a direct member and its current Windows token includes that group. Account and group-member names were not displayed. This group check alone does not establish that the account is dedicated or prove every Docker access-control path.
- The Docker CLI is present, but `docker info` could not connect to `npipe:////./pipe/dockerDesktopLinuxEngine`. The reported error was: “The system cannot find the file specified.” No Docker service was started or modified.
- No Credential Manager entries were opened or read. No server, frontend, or Compose service was started.

**T-001 status: PASS, based on the user's corrected account confirmation and the observed local group membership.** The Docker engine is unavailable, so Compose startup and actual database connectivity remain unverified and block T-003's runtime acceptance checks, not the read-only T-001 verification. The local group check is evidence for the configured Docker-users group only; it is not a comprehensive audit of every possible Docker access path. No secret-dependent service was started.

### Task 2 implementation outcome

T-002 passed after a clean `npm ci`, `npm ls --depth=0`, and direct checks of the Node and Express pins. The package setup was committed as `d750c5d`. HTTP server startup remains assigned to T-005.

### Task 3 execution checkpoint

Docker Desktop was launched after T-003 plan approval and became responsive as Docker server version `29.9.2`. The startup wrapper was invoked twice in child PowerShell processes with one-run, process-scoped execution-policy bypasses, each explicitly approved by the user; the saved execution policy was not changed. The Compose file passes `docker compose config --services` with non-secret placeholder values and exposes only the `postgres` service.

The first two wrapper attempts could not find `USF-PLAN/PostgreSQL` (Win32 error `1168`); neither read a password nor invoked Compose. The user then confirmed the exact Generic Credential was saved under the workspace account. A subsequent wrapper run succeeded after correcting PowerShell native-stderr handling; Docker Compose reported the PostgreSQL container healthy.

Verification passed: Compose defines only `postgres`; Docker reports the host binding as `127.0.0.1:5432`; the host loopback TCP check succeeded; `SELECT 1` succeeded using the configured in-container PostgreSQL role; and a unique temporary marker persisted across container restart, after which the marker table was removed. The named volume `usf-plan-postgres-data` is present. No credential value or credential username was emitted.

**T-003 status: PASS.** Docker Desktop and the PostgreSQL service remain running. PowerShell's saved execution policy remains `Restricted`; the wrapper ran only in a user-approved child process with a process-scoped bypass. The initially suggested GitHub credential target was not accessed or changed.
