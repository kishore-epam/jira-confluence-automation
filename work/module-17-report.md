# Module 17 Completion Report

## Specification Contents
# Feature Specification: USF-PLAN Weekly Status Reporting Platform

**Feature Branch**: Not assigned
**Created**: 2026-10-27
**Status**: Draft
**Input**: Module 08 requirements in `work/module03-task/project_spec.md`, the project constitution in `spec/constitution.md`, and the approved project stack.

## Overview

Build a project-manager-facing application and scheduled report-generation workflow for preparing a concise, client-safe weekly USF-PLAN status report. The product collects approved inputs, identifies source freshness and gaps, calculates the specified measures, generates a six-slide PowerPoint, and makes the result available for project-manager review.

The primary application user is the USF-PLAN project manager. Executive leadership, the client/sponsor, and delivery leads are report recipients. The application must not email, publish, or otherwise distribute reports automatically.

The approved application stack is React 18.3.1 with Vite 7.3.7, Node.js 24.22.1 LTS with Express 5.3.0, and PostgreSQL 15 using Docker Desktop 4.97.0 with Docker Compose CLI v5.6.1 (the verified local baseline). Report generation remains Python 3.12 and runs on a Windows Scheduled Task, as required by the source specification. The Python worker communicates with the Express API over authenticated loopback-only internal endpoints; it does not connect directly to PostgreSQL.

The repository root MUST pin Node.js with `.nvmrc` containing `24.22.1`; Node package manifests MUST declare the Node 24 engine line and commit their lockfiles. `docker-compose.yml` MUST define a `postgres` service using the official `postgres:15` image, a named data volume, and a loopback-only database port binding. The Windows startup wrapper `scripts/start-local-database.ps1` MUST retrieve the PostgreSQL username and password from the Windows Credential Manager Generic Credential target `USF-PLAN/PostgreSQL` and pass them to Compose at runtime for the PostgreSQL container; the target's username is the database role and its password is the role password. The wrapper MUST NOT print or log credential values, put the password in command-line arguments, or persist it in `.env` files, shell history, or committed defaults. Because the database container's environment is inspectable by local Docker users, Docker access MUST be restricted to the dedicated project-manager account and machine administrators. No other container service is required by this prototype.

### Prototype boundary

The prototype runs under a dedicated, non-shared Windows account on the project manager's computer. The React development UI, Express API, PostgreSQL port, and worker callback API MUST bind to loopback addresses only; they MUST NOT be exposed to a LAN, VPN, or public network. Docker Compose runs PostgreSQL only. The Vite development server and Express API run as local processes; the Python worker runs under Windows Task Scheduler. Production hosting, remote or multi-user access, enterprise identity integration, and public deployment are out of scope.

The single local project manager is trusted through the dedicated Windows account for this prototype; interactive sign-in and role-based authorization are out of scope only while every service remains loopback-only. During setup, a cryptographically secure random worker token of at least 256 bits is generated and stored in Windows Credential Manager. The startup wrapper retrieves it for the Express API and scheduled worker processes, but never exposes it to the Vite UI or browser. Worker callbacks use `Authorization: Bearer <token>`; the API MUST reject missing or invalid tokens. Do not put the token in source, environment example files, logs, or the database. If any service must be accessed remotely, implementation is blocked until an approved authentication and authorization design is added.

The prototype supports controlled CSV imports and report generation. Direct Jira/Git/Confluence/capacity API connectors, Excel/XLSX import, automated Confluence summarization, forecast calculations, email/publishing, manual report triggering, and production deployment are out of scope. Out-of-scope report content is shown as unavailable when applicable; it MUST NOT be fabricated.

The Vite UI is served locally at `http://127.0.0.1:5173`, the Express API at `http://127.0.0.1:3000`, and PostgreSQL at `127.0.0.1:5432`. These are development defaults, configurable without changing the loopback-only binding rule. PostgreSQL data uses a named Docker volume and the initial database name is `usf_plan`. This prototype assumes organizational approval for Windows Credential Manager as the local secret store; if policy does not approve it, implementation is blocked until an approved store is selected. Local service credentials are stored there and supplied at runtime by the startup wrapper; `config/` may contain only non-secret examples.

## User Scenarios & Testing

### User Story 1 - Prepare the weekly project update (Priority: P1)

As the project manager, I want to enter the weekly health assessment and narrative updates so the report includes current, approved context rather than relying only on source-system data.

**Why this priority**: Project-manager narrative and the manually selected RAG status are required report content and have a fixed Monday 8:30 a.m. Eastern deadline.

**Independent Test**: Save a reporting-period update containing a RAG value and required narrative fields, reload it, and verify the saved values are shown for that period.

**Acceptance Scenarios**:

1. **Given** an editable reporting period, **When** the project manager submits a RAG status, rationale, accomplishments, risks/blockers, decisions needed, next-week priorities, and milestone changes, **Then** the application saves and displays those values for that period.
2. **Given** a required narrative field or RAG rationale is missing, **When** the project manager saves the update, **Then** the application identifies the missing field and does not report a successful save.
3. **Given** the reporting period has passed its configured PM input deadline, **When** the project manager views the update, **Then** the application indicates that the input is late without silently changing its content.

### User Story 2 - Provide and validate controlled source inputs (Priority: P1)

As the project manager, I want to provide approved source exports when direct integrations are unavailable so a report can be produced without expanding access beyond approved sources.

**Why this priority**: Controlled Jira, Git, Confluence, and capacity CSV exports are the prototype's supported source path. PM narrative is entered in the application; a PM-template CSV can be imported into the same canonical update record.

**Independent Test**: Submit a valid controlled export and an invalid export; verify that the valid input is recorded with its source and freshness metadata and that the invalid input returns actionable validation errors.

**Acceptance Scenarios**:

1. **Given** a supported UTF-8 CSV export and its source type, **When** the project manager uploads it, **Then** the application validates it against the source contract in this specification and reports whether it is usable.
2. **Given** an invalid, unsupported, or ambiguous export, **When** it is submitted, **Then** the application reports the source-specific validation failure and does not mark the input ready.
3. **Given** a previously accepted export, **When** a newer export is accepted for the same source and reporting window, **Then** the application identifies the newer input as current and preserves provenance for the report run that used the earlier input.
4. **Given** an export or import error contains sensitive values, **When** the application logs or displays the error, **Then** credentials and unnecessary personal data are not exposed.
5. **Given** a capacity CSV contains person-level planned hours, **When** it is validated, **Then** the application aggregates hours by reporting week in memory and does not retain the raw capacity file or person-level rows.

### User Story 3 - Understand source readiness and data freshness (Priority: P1)

As the project manager, I want to see which sources are available, stale, missing, or failing so I can judge whether a report is complete and trustworthy.

**Why this priority**: The report must clearly identify missing or stale data and must never silently substitute stale values.

**Independent Test**: Provide a mix of current, stale, missing, and failed source results; verify each is visibly distinguished and included in report warnings.

**Acceptance Scenarios**:

1. **Given** the configured sources for a reporting period, **When** the project manager opens source status, **Then** the application shows each source's status, last successful retrieval or import time, reporting coverage, and any actionable warning.
2. **Given** a source is stale or unavailable, **When** a report is generated from other usable sources, **Then** the generated report labels the source and its data as stale, missing, or unavailable.
3. **Given** a source has not been configured or approved, **When** the project manager views source status, **Then** it is shown as unconfigured or unavailable and the application does not attempt an unapproved site-wide or repository-wide scan.

### User Story 4 - Generate the scheduled weekly report (Priority: P1)

As the project manager, I want the scheduled workflow to generate a report for the preceding seven days and the active sprint so the same reporting interval and measures are applied consistently each week.

**Why this priority**: Scheduled report generation is the primary product outcome and is an explicit Module 08 acceptance criterion.

**Independent Test**: Run the report worker against deterministic source fixtures at a known generation time; verify the exact `America/New_York` reporting window, sprint scope, calculations, warnings, and output files.

**Acceptance Scenarios**:

1. **Given** the scheduled Monday 9:00 a.m. `America/New_York` run and valid inputs, **When** the worker executes, **Then** it uses exactly the immediately preceding seven days ending at generation time and includes the active fixed Scrum sprint.
2. **Given** valid current data and project-manager inputs, **When** generation succeeds, **Then** the worker creates a dated six-slide PowerPoint and updates the `latest` copy under the configured output directory.
3. **Given** optional deployment/release data has no approved source, **When** generation completes, **Then** the metric is omitted or clearly labeled unavailable.
4. **Given** the forecast history does not meet the approved reliability threshold, **When** generation completes, **Then** the forecast is marked unavailable and is not inferred from insufficient history.
5. **Given** a required input or reporting window is invalid, **When** the worker runs, **Then** it fails with an actionable error and preserves the previous successful dated and `latest` reports.
6. **Given** one or more non-required sources are unavailable, **When** enough valid inputs remain for a partial report, **Then** the worker may produce a partial report that clearly identifies every missing or stale source.

### User Story 5 - Review and retrieve a generated report (Priority: P1)

As the project manager, I want to inspect a completed report and retrieve its PowerPoint so I can approve it before manual distribution.

**Why this priority**: Human review is mandatory; automatic email or publishing is prohibited.

**Independent Test**: Create a completed report-run fixture and verify that the project manager can see its period, status, warnings, report artifact, and review decision, while no distribution action is offered.

**Acceptance Scenarios**:

1. **Given** one or more completed report runs, **When** the project manager opens report history, **Then** runs are listed with period, completion time, outcome, and source warnings.
2. **Given** a completed report artifact, **When** the project manager requests it, **Then** the application returns the corresponding local PowerPoint file without changing or distributing it.
3. **Given** a run failed, **When** the project manager opens its details, **Then** the application shows an actionable failure summary and whether the prior successful report was preserved.
4. **Given** a report is available, **When** the project manager reviews it, **Then** no automatic send, publish, approval bypass, or external-distribution control is presented.
5. **Given** the project manager has inspected a completed report, **When** they record approval or request changes, **Then** the application records the decision, timestamp, and optional note against that run; recording approval does not distribute the report.

### User Story 6 - Configure safe reporting thresholds (Priority: P2)

As the local project manager, I want to review and configure approved reporting thresholds and mappings so issue-aging rules can reflect agreed project policy.

**Why this priority**: The five-business-day stale-update and ten-calendar-day in-progress thresholds are explicitly configurable, while the initial values must remain visible and testable.

**Independent Test**: Set a valid threshold, read it back, and verify that report calculations use it; reject invalid values without changing the prior configuration.

**Acceptance Scenarios**:

1. **Given** the current configuration, **When** the local project manager views reporting settings, **Then** the configured aging thresholds and status mappings are shown.
2. **Given** a valid approved threshold change, **When** it is saved, **Then** subsequent report runs use the new value and retain the value used by earlier runs in their run metadata.
3. **Given** an invalid threshold or mapping, **When** it is submitted, **Then** the application rejects it with a validation message and retains the previous configuration.

### User Story 7 - Import PM-template narrative (Priority: P2)

As the project manager, I want to import the supported PM-template CSV into the weekly update form so existing manually prepared content can be reused without creating a second source of truth.

**Why this priority**: Module 08 names a PM Excel template, while the application also provides PM narrative fields. A single canonical update prevents divergent report content.

**Independent Test**: Import a valid PM-template CSV, verify its values populate the update form, change one field, and verify that only the saved application update is used by a report run.

**Acceptance Scenarios**:

1. **Given** a valid PM-template CSV for a reporting period, **When** it is imported, **Then** its narrative fields populate the editable project update and remain unsaved until the project manager confirms save.
2. **Given** an imported PM-template CSV and later edits in the application, **When** a report is generated, **Then** the saved application update is canonical and the template is not independently merged into the report.
3. **Given** a PM-template CSV is invalid or for a different reporting period, **When** it is imported, **Then** the application rejects it with field-level errors and leaves the saved update unchanged.

### Edge Cases

- The configured Jira, Git, Confluence, capacity, or PM source is missing, stale, inaccessible, or returns malformed data.
- Multiple exports exist for the same source and reporting period; an export has ambiguous or conflicting timestamps.
- The generation time falls at a daylight-saving transition in `America/New_York`.
- An issue's update age is exactly on the configured threshold or its status is not mapped.
- A sprint has zero committed points, no active sprint, changed scope, or unavailable estimate data.
- Actual worklogs and planned allocations use different periods or units, or capacity input contains person-level data that must not appear in client-facing output.
- Forecast history is absent, insufficient, or inconsistent.
- The PM update is missing, late, partially complete, or changed while a report run is in progress.
- A report file is locked, the output directory is unavailable, or the worker fails while writing the dated or `latest` file.
- A report run retries or overlaps another scheduled run.
- A user requests an artifact or input for which they are not authorized.
- External source content contains secrets, personally identifying information, unexpected markup, or content too large to process safely.
- A request attempts to access the local API, source inputs, or report artifacts from a non-loopback network interface.
- Two scheduled worker invocations overlap or the worker retries after an API timeout.

### Metric and period definitions

- The reporting interval is the half-open interval from the previous Monday at 9:00 a.m. to the scheduled Monday trigger at 9:00 a.m. `America/New_York`. It is seven local calendar days and may be 167 or 169 elapsed hours across daylight-saving transitions. All retries reuse the original scheduled trigger as their anchor. Calculate both boundaries in `America/New_York`, then persist their UTC equivalents. Display the local start and end, including timezone, in the report.
- For Jira sprint-scope history, coverage must begin no later than the active sprint start and end no earlier than the report end. For time-window measures, source coverage must include the complete reporting interval.
- The default stale-update threshold is reached when an issue has had no update for at least five business days. For this prototype, a business day is Monday through Friday; holidays are not excluded. Business-day age counts weekdays in `(last_updated_local_date, report_end_local_date]`.
- An issue is in progress when its configured normalized status category is `in_progress`. Its continuous in-progress age starts at its latest transition into that category. Flag it only when age is greater than ten calendar days. If source history does not provide the transition timestamp, label this age unavailable; do not infer it from the issue's last-updated time.
- Sprint committed points are the baseline estimates for distinct issues whose membership interval includes the sprint start. Completed points are current estimates for distinct issues completed during a membership interval in the active sprint by report end, including issues added after sprint start. Remaining points are current estimates for distinct unfinished issues whose membership interval includes report end. Count membership additions/removals after sprint start and their estimates at the event separately; do not silently rewrite the committed baseline. A missing baseline estimate, current estimate, or incomplete membership history makes the affected measure partial or unavailable.
- Worklog actual hours are the sum of Jira worklog hours whose start instants fall inside the reporting interval. Planned weekly capacity is the sum of approved allocations for the same reporting week. Display the two totals separately, to one decimal place, and never persist or display person-level capacity rows in report-facing data.
- The capacity CSV `week_start` is the local Monday date at the start of the reporting interval. Report the full planned allocation for that named Monday–Sunday week alongside actual worklog hours for the exact rolling seven-day interval; label both periods explicitly and do not prorate the weekly plan.
- Git activity is the count of distinct commit SHAs in the configured repository allowlist with commit instants inside the reporting interval.
- The project manager supplies the overall RAG status and rationale. The system does not infer RAG from metrics.
- A milestone is complete only when its configured Jira status is mapped to `done`. Any other milestone whose due date is before the report-end local date is `overdue`; all other milestones are `on track`. The prototype does not accept a separate PM-entered milestone health value. Missing status or due-date data makes health unavailable.
- Normalized issue `status_category` values are limited to `todo`, `in_progress`, and `done`. Project-specific Jira status names are mapped to these categories through versioned settings. Unknown statuses make affected measures partial and appear as a warning.
- Each issue's supplied `status_category` MUST match the configured mapping for its `status`; mismatched pairs are rejected.
- The default blocker link mapping recognizes Jira link types `blocks` and `is blocked by`; projects may add explicit mappings. Unmapped link types are not treated as blockers.
- Project-specific Jira milestone status names use the versioned status mapping. In the prototype, milestone health follows only the completion/due-date rule above; narrative milestone changes remain PM-authored text.

### Prototype CSV contracts

The upload metadata MUST include `exportedAtUtc`, `coverageStartUtc`, and `coverageEndUtc` as ISO 8601 UTC timestamps, plus the project key. The server validates that the declared source scope is USF-PLAN or an approved allowlist entry. CSVs MUST be UTF-8 with a header row, use ISO 8601 UTC timestamps, and have unique column names. Unknown columns are rejected. Required values and rows are validated before acceptance. Empty required datasets are represented by a header-only CSV with valid upload metadata.

| Source/dataset | Required CSV columns | Notes |
|---|---|---|
| Jira `issues` | `issue_key,title,status,status_category,updated_at_utc,in_progress_since_utc,story_points,issue_type,client_shareable` | `client_shareable` is `true` or `false`. Only true rows may appear with issue key/title in the report; metrics may still aggregate all in-scope rows. `in_progress_since_utc` may be empty only when the issue is not in progress or history is unavailable; unavailable history is reported. `story_points` is a non-negative decimal or empty. |
| Jira `sprints` | `sprint_id,name,state,start_at_utc,end_at_utc` | Exactly one active sprint (`state=active`) is required for a full report. |
| Jira `sprint-scope` | `sprint_id,issue_key,added_at_utc,removed_at_utc,story_points_at_sprint_start,story_points_current,completed_at_utc` | One row per continuous issue/sprint membership interval; `added_at_utc` is required and empty `removed_at_utc` means currently in scope. Re-addition after removal is a new row; intervals for the same issue/sprint MUST NOT overlap. An issue added after sprint start has empty baseline points. |
| Jira `worklogs` | `worklog_id,issue_key,started_at_utc,hours` | `hours` is non-negative decimal. Person identity MUST NOT be included. |
| Jira `issue-links` | `issue_key,linked_issue_key,link_type` | Link types are normalized through configuration; blocker relationships are included in the report. |
| Jira `milestones` | `milestone_key,name,due_date,status,updated_at_utc,client_shareable` | Dates use ISO `YYYY-MM-DD`; status is mapped through the configured Jira status/version mapping. Only true rows may appear by name in the client-facing report. |
| Git `commits` | `repository,commit_sha,committed_at_utc` | `repository` must match the configured allowlist; duplicate SHAs are counted once. |
| Confluence `pages` | `page_id,title,url,updated_at_utc,summary,client_shareable` | Only pages in an explicitly configured USF-PLAN space/allowlist are accepted. `summary` is supplied in the controlled export; the prototype does not automatically summarize page bodies. URLs must use the configured Confluence host and approved project-space path, with no URL credentials, query, or fragment. Only true rows may appear in the report. |
| Capacity `allocations` | `person_key,week_start,planned_hours` | `person_key` is used only to detect duplicate allocations and MUST be discarded after aggregation. `week_start` is the Monday local date at the reporting interval start; the full Monday–Sunday plan is reported beside actuals for the exact rolling interval, without proration. No person's key or hours are stored. |
| PM template `weekly-update` | `period_end_local_date,rag_status,rag_rationale,accomplishments,risks_and_blockers,decisions_needed,next_week_priorities,milestone_changes` | A single data row. List fields use `\|` as the item delimiter. Import populates the application update form; saved application data is canonical. |

Each Jira dataset is uploaded separately with its dataset name. A full Jira report requires valid, current `issues`, `sprints`, and `sprint-scope` inputs. Missing, stale, invalid, or incomplete PM update or any of those Jira datasets fails the run. Missing/stale worklogs, issue links, milestones, Git, Confluence, or capacity data yields a partial report with the affected measure marked unavailable. An active sprint missing or multiple active sprints is a Jira validation failure. Duplicate issue keys, worklog IDs, commit SHAs with conflicting timestamps, page IDs, or sprint membership events are rejected unless the contract explicitly defines deduplication (Git commit SHAs are deduplicated). Blocker references are shown only when every referenced issue is marked `client_shareable`; otherwise only aggregate blocker counts are shown. Jira and Confluence exports MUST mark client-facing eligibility explicitly, and only eligible titles, names, URLs, and summaries may appear in the deck.

For Jira issue/milestone and Confluence page uploads, the project manager MUST attest that all `client_shareable` flags were reviewed against the applicable client-sharing policy. This attestation and its timestamp are recorded with input provenance. The flag is an explicit inclusion decision, not an automated sensitivity classifier.

The prototype accepts CSV only. Excel workbooks, arbitrary JSON, archives, automatic source normalization beyond these contracts, direct source connectors, and automatic Confluence page-body summarization are out of scope. Confluence summaries are supplied in the CSV and at most three current, `client_shareable` project references appear on slide 6. The project-space and Git repository allowlists must be configured before those sources are accepted; if no allowlist is configured, those datasets are rejected and the corresponding report content is unavailable.

## Functional Requirements

### Reporting and data

- **FR-001**: The system MUST identify the project as USF-PLAN and provide a project-manager workflow for preparing its weekly status report.
- **FR-002**: The system MUST collect the PM-provided RAG status and rationale, accomplishments, risks/blockers, decisions needed, next-week priorities, and milestone changes.
- **FR-003**: The system MUST cover both the rolling seven-day reporting window and the current active fixed Scrum sprint.
- **FR-004**: The system MUST calculate and report committed, completed, and remaining sprint story points.
- **FR-005**: The system MUST report issue status and aging, flagging no-update age at five business days and continuous in-progress age beyond ten calendar days by default; the thresholds MUST be configurable.
- **FR-006**: The system MUST include blockers, dependencies, scope changes, milestone health, Jira milestones, and Git commit counts across the approved project repository allowlist.
- **FR-007**: The system MUST compare weekly Jira worklog actuals with planned weekly capacity allocations and MUST keep these measures distinct from Jira issue-level estimates.
- **FR-008**: The system MUST show forecasts only when the configured, approved history threshold is met, and MUST show the forecast basis and confidence; otherwise it MUST label the forecast unavailable.
- **FR-009**: The system MUST support controlled source exports when direct integrations are not approved or available.
- **FR-010**: The system MUST show source status, coverage/freshness, and actionable warnings and MUST identify unavailable, failed, or stale data in any report that uses partial data.
- **FR-011**: The system MUST treat deployment/release activity as optional until its source has been identified and approved.
- **FR-012**: The system MUST produce a neutral stakeholder-oriented PowerPoint of exactly six slides with the required measures, PM narrative, report period, freshness information, and missing-data warnings.
- **FR-013**: On each successful or partial run, the system MUST save a dated report and atomically update a `latest` copy under the configured local output directory; it MUST retain each dated report for one year.
- **FR-014**: On generation failure, the system MUST preserve the previous successful report and MUST report an actionable failure.
- **FR-015**: The system MUST make reports available for project-manager review and manual retrieval, and MUST NOT email, publish, or distribute them automatically.

### Privacy, security, and operations

- **FR-016**: The system MUST use least-privilege, read-only access for external source integrations.
- **FR-017**: The system MUST NOT store credentials in source code, database records, logs, source exports, or generated reports. Approved secrets MUST be held in an organization-approved secret store.
- **FR-018**: Client-facing reports MUST represent the delivery group in aggregate and MUST NOT include named planned or actual hours in this prototype. A future exception requires a separately approved specification change; no approval flag in the prototype enables named output.
- **FR-019**: The system MUST restrict source inputs and generated reports according to organizational policy and MUST NOT scan beyond configured project, repository, or Confluence allowlists.
- **FR-020**: The system MUST log execution time, source success/failure, and output location without logging secrets or unnecessary personal data.
- **FR-021**: The scheduled workflow MUST run every Monday at 9:00 a.m. `America/New_York`; PM input is due Monday at 8:30 a.m. Eastern.
- **FR-022**: The system MUST validate required inputs, configuration, access, and reporting-window boundaries and fail with an actionable error when required conditions are invalid.
- **FR-023**: The application MUST use React 18.3.1 and Vite 7.3.7, Node.js 24.22.1 LTS and Express 5.3.0, and PostgreSQL 15 through Docker Desktop 4.97.0 with Docker Compose CLI v5.6.1. The report worker MUST use Python 3.12 and Windows Task Scheduler unless an approved specification change replaces those requirements.
- **FR-024**: The system MUST retain the source provenance and configuration values needed to determine which inputs, thresholds, and mappings were used for each report run.
- **FR-025**: The system MUST NOT persist person-level capacity rows or person identifiers in report-facing data. Jira worklog exports MUST omit person identity. Capacity rows MAY be held transiently in memory only for duplicate detection and aggregation, then MUST be discarded.
- **FR-026**: The prototype MUST be single-user and local-only; application and database services MUST bind to loopback, and remote access MUST remain disabled.
- **FR-027**: The worker MUST authenticate internal callbacks with a service token stored in Windows Credential Manager; the API MUST reject missing or invalid worker tokens without disclosing token details.
- **FR-028**: The PM update entered or imported into the application MUST be the canonical report narrative. Importing the PM-template CSV populates that update and MUST NOT create a separate narrative source for report generation.
- **FR-029**: PM update content and Jira input are required for a report run. If either is missing, invalid, or outside the required coverage, the run MUST fail and preserve the previous successful report. Missing optional source inputs MAY produce a partial report with explicit warnings.
- **FR-030**: The prototype MUST accept UTF-8 CSV files only, with a 25 MiB maximum per upload, and MUST reject unsupported types, malformed CSV, path-like filenames, and files outside the declared source scope.
- **FR-031**: Each source upload MUST include its source extraction timestamp and coverage interval as request metadata. A source is current only when its extraction timestamp is no more than seven calendar days before and no later than the scheduled trigger time, and its coverage includes the required reporting interval (and, for Jira sprint-scope history, the active sprint from its start); otherwise it MUST be marked stale or incomplete.
- **FR-032**: The system MUST retain accepted non-capacity source CSVs for no more than seven calendar days after validation, then delete them. Rejected or temporary upload files MUST be deleted immediately after validation. Capacity CSVs MUST be deleted immediately after successful or failed validation/aggregation. Safe metadata, hashes, and report-run provenance MAY be retained for audit.
- **FR-033**: The system MUST prevent overlapping scheduled runs with a single-worker lock. Retries MUST be associated with the original reporting period, and failed attempts MUST NOT replace any existing report artifact.
- **FR-034**: The application MUST record the project manager's explicit review decision (approved or changes requested), time, and optional note for each report run. Approval MUST NOT initiate distribution.
- **FR-035**: In the prototype, the five-business-day issue-age calculation MUST count Monday through Friday with no holiday exclusions, using weekdays in `(last_updated_local_date, report_end_local_date]`.
- **FR-036**: The prototype MUST display exactly six standard report sections/slides, allowing a section to state unavailable when its optional source is absent: executive summary/RAG; sprint progress/scope; milestones/forecast availability; issues/blockers/dependencies/decisions; aggregate capacity/Git activity; and next-week priorities/source freshness.
- **FR-037**: The API MUST cap list endpoints at 100 items per page (default 50), use opaque cursors, return field-level validation errors for invalid inputs, and never echo uploaded file contents in errors.
- **FR-038**: The system MUST retain report-run metadata, report-safe metrics, PM updates, review records, settings versions, and capacity aggregates for one year after the associated reporting period, then delete them. Operational logs MUST be purged after 90 days. Non-capacity accepted raw source exports MUST be purged within seven calendar days; rejected uploads and capacity exports MUST be deleted immediately after processing.
- **FR-039**: The scheduled worker MUST make at most three retries for transient internal API failures, with delays of 1, 5, and 15 minutes. Validation failures are terminal. Every retry MUST occur within 30 minutes of the scheduled trigger and use the same reporting period, PM update revision, source-input IDs, and settings version as the original run; completion callbacks MUST be idempotent by report-run ID.
- **FR-040**: The application MUST validate Confluence page URLs against the configured Confluence host and project-space path and MUST reject rows outside the approved allowlist.
- **FR-041**: The project manager MUST provide an explicit value for each PM narrative field before submission; narrative list fields may be explicitly empty when there is nothing to report. RAG status and rationale are mandatory.
- **FR-042**: The source upload pipeline MUST reject duplicate source row identifiers except for Git commit SHAs, which are deduplicated when repository, SHA, and timestamp agree and rejected when they conflict.
- **FR-043**: The local API task MUST start the Docker Compose database and Express API at user logon and remain available for the weekly task. The Vite UI is started on demand. The weekly task runs only in the project manager's signed-in Windows session, verifies Docker/API and required-input prerequisites, and fails safely if they are unavailable. A missed trigger while the computer is asleep, powered off, or not signed in is not replayed. VPN connectivity is required only when the project manager retrieves corporate exports, not for local report generation.
- **FR-044**: A PM update saved after the 8:30 a.m. Eastern deadline but before the Monday 9:00 a.m. trigger MUST be marked late but MAY be included in that scheduled run. An update saved after the trigger is not eligible for that run.

## API Endpoints

The following is the proposed versioned REST contract between the React application and Express API. It describes the intended data flow, not an implemented service. JSON is used for request and response bodies except controlled file uploads. Browser-facing endpoints are loopback-only for the single local operator; worker endpoints additionally require the service token. Errors use a consistent response shape: `{ "error": { "code": "...", "message": "...", "details": [] } }`; responses MUST NOT include secrets.

| Method and path | Purpose and data flow |
|---|---|
| `GET /healthz` | Loopback-only liveness/readiness check for the local API task. Returns API readiness and database readiness only; it MUST NOT return versions, configuration, file paths, or secrets. |
| `GET /api/v1/dashboard` | Returns the current reporting period, PM-input completion/deadline state, latest report-run summary, source readiness summary, and warning counts. No raw source data or credentials are returned. |
| `GET /api/v1/project-updates?periodStart={date}&periodEnd={date}` | Returns the PM narrative record for the requested reporting interval, if one exists, together with validation/completion state. |
| `PUT /api/v1/project-updates/{periodEnd}` | Creates a new immutable revision for a reporting period. Body: `ragStatus`, `ragRationale`, `accomplishments[]`, `risksAndBlockers[]`, `decisionsNeeded[]`, `nextWeekPriorities[]`, and `milestoneChanges[]`. The path date is the report-period end local date in `America/New_York`; the API validates that content and period. |
| `GET /api/v1/sources` | Returns configured source types and safe readiness metadata: configured/approved state, latest successful retrieval/import time, coverage period, freshness state, and warnings. Never returns secret values. |
| `POST /api/v1/source-inputs/{sourceType}/{dataset}` | Accepts one UTF-8 CSV as multipart form data plus `exportedAtUtc`, `coverageStartUtc`, `coverageEndUtc`, and `projectKey` fields. Jira issue/milestone and Confluence page uploads also require `clientSharingAttested=true`. Supported source/dataset pairs are defined in **Prototype CSV contracts**. The API validates content and scope, records provenance, and stores accepted non-capacity files in the access-controlled input area. Capacity rows are aggregated in memory and the raw capacity file is deleted immediately. The PM-template dataset populates the editable application update and is not an independent report source. Maximum upload is 25 MiB. |
| `GET /api/v1/source-inputs?periodStart={date}&periodEnd={date}` | Returns metadata and validation outcomes for inputs associated with a reporting interval; never returns file contents or retained local paths to the browser. |
| `GET /api/v1/report-settings` | Returns non-secret report settings, including aging thresholds, status mappings, reporting timezone, configured project scope, and forecast readiness/threshold state. |
| `PUT /api/v1/report-settings` | Updates validated, non-secret settings such as aging thresholds, status mappings, and allowlists for the single local operator. The operator confirms the change as the local project manager; the request includes a `changeReason` (1–500 characters), and the new immutable settings version records the reason and timestamp. It MUST NOT accept integration passwords or tokens. |
| `GET /api/v1/report-runs?limit={n}&cursor={token}` | Returns paginated run history with run ID, reporting interval, scheduled/start/end times, status, source warning summary, and artifact availability. |
| `GET /api/v1/report-runs/{runId}` | Returns run details, per-source success/failure/freshness, validation warnings, metric availability, output metadata, and actionable failure information. It MUST exclude secrets and unnecessary person-level data. |
| `POST /api/v1/report-runs/{runId}/review` | Records the local project manager's explicit review decision. Body: `decision` (`approved` or `changes_requested`) and optional `notes` (maximum 2,000 characters). Returns the saved review record. This records review only; it does not send, publish, or modify the report. |
| `GET /api/v1/report-runs/{runId}/artifact` | Streams the completed PowerPoint for local project-manager review. The file remains in local report storage; this endpoint does not distribute it externally. |
| `POST /internal/v1/report-runs/claim` | Worker-only endpoint, authenticated by the Windows Credential Manager service token. Atomically claims the scheduled reporting period and returns the PM update, current settings version, accepted source metadata/local file references, aggregate capacity totals, and period boundaries. Returns conflict if another run is active. It cannot be called from the browser UI. |
| `POST /internal/v1/report-runs/{runId}/heartbeat` | Worker-only authenticated endpoint. Renews the run lease while the scheduled worker is active; a lease expires after five minutes without a heartbeat. |
| `POST /internal/v1/report-runs/{runId}/complete` | Worker-only authenticated callback. Body: final status (`succeeded`, `partial`, or `failed`), per-source results, safe failure summary, report-safe aggregate metrics, and staged artifact filename/hash. The worker writes to a unique per-run staging file and never overwrites a final artifact. The API accepts only paths resolved beneath `data/reports/`, verifies the run claim is still active, then atomically promotes the immutable dated artifact and updates the project's latest-run pointer and `latest.pptx` copy for a successful/partial report. Late or duplicate completions cannot replace a newer artifact. |

### API data rules

- Dates and timestamps MUST include an explicit timezone or be interpreted using the documented `America/New_York` reporting rule. Persist run timestamps in UTC and preserve the reporting timezone and computed start/end instants.
- PM update values MUST be present: `ragStatus` is `red`, `amber`, or `green`; `ragRationale` is 1–2,000 characters; each narrative list may be empty but has at most 20 entries, each 1–500 characters. Empty list fields mean “nothing to report”; omitted or null fields are validation errors.
- The Express API MUST allow browser requests only from the configured Vite origin and loopback Host values; wildcard CORS is prohibited. Worker requests without a browser Origin are accepted only with the valid worker token.
- Source input responses MUST identify validation status and a safe error summary; they MUST NOT echo secret or unnecessary personal values. User-supplied source timestamps and `client_shareable` values are uploader assertions; the prototype does not cryptographically verify source exports or sharing classifications.
- A report run MUST reference the exact PM update, accepted source inputs, and settings version it consumed.
- No endpoint may send or publish a report. The review endpoint records only the decision explicitly submitted by the local project manager; it MUST NOT approve a report automatically.
- Internal worker endpoints MUST be bound to loopback and require the service token; the token is compared without logging it and is never returned in a response. The startup wrapper retrieves the token from Windows Credential Manager for the API and worker processes.
- In the prototype, browser-facing endpoints are unauthenticated only because the entire service is loopback-only and single-user. The API MUST reject non-loopback connections, accept browser requests only from the exact Vite origin `http://127.0.0.1:5173`, validate the `Host` header against its configured loopback host/port, and require the expected origin on every state-changing browser request.
- List endpoints use an opaque cursor, default to 50 records, and MUST NOT return more than 100 records per page.
- Invalid field values return HTTP 422 with safe field-level details; malformed requests return 400; absent records return 404; duplicate/overlapping runs return 409; oversized uploads return 413; invalid worker credentials return 401; unexpected server errors return a generic 500 response with a correlation ID.
- A manual report-generation endpoint is intentionally not provided. Adding on-demand generation or remote access is out of scope for the prototype.
- The worker renews its claim through `POST /internal/v1/report-runs/{runId}/heartbeat` every 60 seconds. A claim expires after five minutes without a heartbeat and may then be retried for the same reporting period and captured input/settings snapshot, within the retry limit above. A late completion from an expired claim cannot replace a newer completed artifact.
- The worker claim endpoint returns only the capacity aggregate, never the source CSV or person-level rows. Accepted non-capacity file references are local to the same Windows computer and are never returned by browser-facing endpoints.

## UI Screens

### 1. Weekly dashboard

Shows the current reporting window and timezone; PM input deadline and completion state; source readiness summary; latest run status; report availability; and prominent stale/missing-source warnings. It links to the relevant input, source, and report details. It does not expose secret values or named capacity data.

### 2. Project-manager weekly update

Provides fields for RAG status and rationale, accomplishments, risks/blockers, decisions needed, next-week priorities, and milestone changes. Displays the applicable reporting period, Monday 8:30 a.m. Eastern deadline, validation errors, and saved/unsaved state. It distinguishes missing required narrative from optional content.

The PM-template CSV import fills this form as an unsaved draft. The user must review and save it; imported values never override a saved update silently.

### 3. Source inputs and validation

Allows the project manager to select a configured source and reporting period, submit a controlled export, and view validation results, coverage, provenance, and freshness. For Jira issue/milestone and Confluence uploads, it requires explicit confirmation that `client_shareable` flags were reviewed. It displays accepted, rejected, stale, and superseded input states. It must not display credentials or expose raw person-level capacity in client-facing views.

### 4. Source readiness

Lists Jira, Git hosting, Confluence, capacity-planning, and PM-template sources, including only approved project/repository/space scope. Shows configured/approved state, last successful retrieval or import, coverage, freshness, and actionable errors. Missing deployment/release configuration is identified as optional/unavailable.

### 5. Report history and run details

Lists reports by period, status, and completion time. A run-detail view shows its reporting window, source outcomes and freshness, warnings, metrics unavailable, failure summary, and whether a previous successful report was preserved. The local project manager can retrieve a completed PowerPoint for review. There is no send, publish, or automatic distribution action.

For a completed or partial report, the project manager can record `approved` or `changes requested` with an optional note. The decision, timestamp, and local actor label are shown on the run. Review state does not trigger a retry or distribution.

### 6. Reporting settings

Shows and permits the local project manager to edit configurable issue-aging thresholds, status mappings, repository/space allowlists, and source-freshness threshold, with validation, a required change reason, explicit confirmation, and clear indication of active settings. It displays forecast configuration as unavailable in the prototype. It does not accept or reveal secrets.

The prototype has a single local operator, so there are no role-management controls. The forecast threshold is visibly not configured and forecasts remain unavailable; users cannot enable forecast output until a future approved feature defines its method and evidence threshold.

The prototype UI is supported in the current stable Microsoft Edge on Windows at desktop width. Remote browsers, mobile layouts, and cross-browser certification are out of scope.

## Standard Report Layout

The generated deck contains exactly six slides in this order:

1. **Executive summary** — reporting period, PM-selected RAG and rationale, top accomplishments, and highest-priority attention items.
2. **Sprint progress and scope** — committed, completed, remaining points, scope additions/removals, active sprint identity, and any estimate/coverage caveats.
3. **Milestones and forecast availability** — milestone health and changes; forecasts are marked unavailable in this prototype.
4. **Issue health and decisions** — stale/in-progress issue counts and references only to Jira issues marked `client_shareable`, blockers and dependencies (aggregated when references are not shareable), risks, and decisions needed.
5. **Delivery activity and capacity** — aggregate actual/planned hours shown separately, issue estimates excluded from allocation totals, Git commit count, and source availability indicators.
6. **Next-week priorities and data quality** — priorities, source freshness/coverage, missing or stale data, optional source status, and up to three `client_shareable` Confluence project-document references with supplied summaries.

Each slide may state that a metric is unavailable or partial, but the deck remains exactly six slides. Do not add a slide solely to carry data-quality caveats.

## Data Model

The following are logical PostgreSQL entities. They define what the product needs to persist, not a finalized physical schema. Generated PowerPoint files and controlled source files remain in the configured access-controlled local filesystem; PostgreSQL stores metadata and references, not file contents. Secrets remain in Windows Credential Manager. SQL column types, indexes, migration tooling, backup/recovery, high availability, and production performance targets are out of scope for this local prototype and must be specified before production use.

### Project

- `project_id` (primary key)
- `project_key` (unique; initially `USF-PLAN`)
- `display_name`
- `reporting_timezone` (initially `America/New_York`)
- `allowed_git_repositories` and `allowed_confluence_scope` (explicit non-secret allowlists)
- `latest_report_run_id` (nullable pointer to the most recent successful or partial report)
- `created_at`, `updated_at`

### ReportingPeriod

- `period_id` (primary key)
- `project_id` (foreign key)
- `starts_at_utc`, `ends_at_utc`
- `reporting_timezone`
- `period_end_local_date`
- `created_at`

The period represents the seven days immediately preceding generation and is associated with the active sprint through the source snapshot/run. Boundary semantics must be tested at daylight-saving transitions.

### ProjectUpdate

- `update_id` (primary key)
- `project_id`, `period_id` (foreign keys; one current update per project and period)
- `revision_number` (positive integer; unique within project and period)
- `supersedes_update_id` (nullable self-reference)
- `rag_status` (Red, Amber, or Green)
- `rag_rationale`
- `accomplishments`, `risks_and_blockers`, `decisions_needed`, `next_week_priorities`, `milestone_changes` (structured text/list values)
- `submitted_at`, `updated_at`
- `actor_label` (fixed local project-manager label in the single-user prototype)

Saving an edit creates a new immutable revision. Earlier report runs continue to reference the revision they consumed. PM narrative may contain sensitive project information and MUST receive access controls equivalent to the report. It MUST NOT contain credentials.

### SourceInput

- `source_input_id` (primary key)
- `project_id`, `period_id` (foreign keys where period is known)
- `source_type` (Jira, Git, Confluence, capacity plan, or PM template)
- `dataset` (for example, Jira issues or Jira sprints)
- `input_mode` (controlled export or approved connector)
- `storage_key` (nullable opaque local-file reference; no secret-bearing paths)
- `content_hash`, `received_at`
- `coverage_start`, `coverage_end`
- `validation_status` and safe `validation_summary`
- `client_sharing_attested_at` (nullable; required for client-shareable Jira issue/milestone and Confluence page datasets)
- `retention_until` (no later than seven calendar days after validation; capacity input has no retained file)
- `metadata_purge_at` (one year after the associated reporting period)
- `supersedes_source_input_id` (nullable self-reference)

Do not store raw file contents in database rows. Avoid retaining original filenames when they may contain personal data. Non-capacity CSV files are access-controlled, purged within seven calendar days after validation, and excluded from client-facing responses. Capacity CSVs and person-level rows are processed in memory, aggregated, and immediately discarded; only aggregate capacity and safe provenance metadata are persisted.

### ReportSettingsVersion

- `settings_version_id` (primary key)
- `project_id` (foreign key)
- `issue_stale_business_days` (initially 5)
- `in_progress_stale_calendar_days` (initially 10)
- `status_mapping` (configured mapping)
- `source_freshness_days` (initially 7 calendar days)
- `allowed_git_repositories`, `allowed_confluence_scope`
- `forecast_history_threshold` (unset; forecasting is disabled in this prototype)
- `configuration` (validated, non-secret project/report settings)
- `change_reason` (required reason for each new settings version)
- `effective_at`, `created_at`, `created_by`

In the single-user prototype, `created_by` is a fixed local operator label and is not an authenticated identity claim.

Passwords, access tokens, and private keys MUST NOT be included in this entity.

### CapacityAggregate

- `capacity_aggregate_id` (primary key)
- `project_id` (foreign key)
- `week_start_local_date`
- `planned_hours_total` (non-negative decimal, rounded for display only)
- `source_input_id` (foreign key to metadata/hash only; no capacity file is retained)
- `created_at`

Exactly one aggregate is stored per project and reporting week. Person keys and person-level hours are never written to PostgreSQL or logs.

### ReportRun

- `report_run_id` (primary key)
- `project_id`, `period_id`, `settings_version_id` (foreign keys)
- `project_update_id` (foreign key to the exact PM update consumed by this run)
- `trigger_type` (scheduled only in the prototype)
- `retry_of_report_run_id` (nullable self-reference)
- `status` (queued, running, succeeded, partial, or failed)
- `scheduled_at`, `started_at`, `completed_at`
- `lease_expires_at`, `last_heartbeat_at` (nullable while not running)
- `worker_version`
- `failure_code` and safe `failure_summary` (nullable)
- `previous_success_preserved` (boolean)

Each run references the precise PM update it consumed and its source inputs through the association below.

### ReportReview

- `review_id` (primary key)
- `report_run_id` (foreign key)
- `decision` (`approved` or `changes_requested`)
- `reviewed_at`
- `actor_label` (fixed local project-manager label in the single-user prototype; no identity claim)
- `notes` (nullable, access-controlled)

Review records are append-only. A later decision creates a new record; the most recent record is the current review state.

### Operational retention

The prototype purges PM updates, report runs, reviews, settings versions, source-input metadata, report-safe metrics, capacity aggregates, and dated PowerPoint files one year after the associated reporting period. Operational logs are purged after 90 days. `latest.pptx` is a convenience copy of the most recent successful or partial dated report; it is replaced atomically only by such a run and is deleted, with the project pointer cleared, when its associated dated artifact reaches its one-year retention deadline. Retention cleanup runs daily and records aggregate counts of deleted records without logging sensitive content.

### ReportRunInput

- `report_run_id`, `source_input_id` (composite primary key and foreign keys)
- `input_role`
- `consumed_at`

### ReportSourceResult

- `source_result_id` (primary key)
- `report_run_id` (foreign key)
- `source_type`
- `dataset` (nullable; distinguishes Jira issues, sprint, worklog, and other datasets)
- `status` (succeeded, stale, unavailable, failed, or not configured)
- `coverage_start`, `coverage_end`, `retrieved_at`
- `warning_code` and safe `warning_summary`

### ReportArtifact

- `artifact_id` (primary key)
- `report_run_id` (foreign key)
- `artifact_kind` (dated only; immutable per report run)
- `storage_key` (local filesystem reference)
- `content_hash`, `created_at`
- `retention_until` (one year after the associated reporting period)

The database stores the artifact reference and integrity metadata, not the PowerPoint bytes. Dated files use `USF-PLAN-weekly-status-YYYY-MM-DD.pptx`, where the date is the report-end local date. `latest.pptx` is a replaceable convenience copy, not a second historical artifact. The local input, database, log, and artifact directories MUST have Windows ACLs that grant access only to the dedicated project-manager account, SYSTEM, and local Administrators; the artifact directory follows the one-year retention requirement.

### ReportMetric

- `report_metric_id` (primary key)
- `report_run_id` (foreign key)
- `metric_key`, `display_label`
- `numeric_value` or `text_value`
- `unit`
- `availability_status` (available, unavailable, or partial)
- `basis_summary` and `confidence_summary` (nullable)

Persist only report-safe aggregates and calculation provenance. Do not persist person names or per-person planned/actual hours as report metrics.

### Entity relationships

- A project has reporting periods, project updates, source inputs, settings versions, and report runs.
- A report period has one or more immutable project-update revisions, of which the latest is current, and can be referenced by multiple report runs.
- Each report run uses one settings version and may reference multiple source inputs and per-source results.
- Each report run references the precise project update used to render its narrative.
- Each report run can have multiple append-only review records and retry attempts for the same reporting period.
- A successful or partial report run may have dated and `latest` artifact references.
- Metrics and source results belong to a single report run.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A scheduled Monday 9:00 a.m. Eastern run selects exactly the immediately preceding seven days in `America/New_York` and includes the active fixed Scrum sprint.
- **SC-002**: A successful run creates a readable PowerPoint containing exactly six standard slides and all required available measures and PM narrative.
- **SC-003**: Every missing, stale, failed, or unavailable source used by a partial report is visibly identified in the report and run details.
- **SC-004**: Client-facing report output contains aggregate planned and actual capacity only and contains no named planned or actual hours in this prototype.
- **SC-005**: No report is emailed, published, or distributed automatically; each report is available for project-manager review before manual distribution.
- **SC-006**: A failed generation leaves the prior successful report artifact unchanged and reports an actionable failure.
- **SC-007**: Dated successful or partial reports remain available for one year, and each successful or partial run updates the `latest` report without changing it on failure; the latest copy is removed when its associated report reaches the retention deadline.
- **SC-008**: Invalid required inputs and invalid reporting-window boundaries are rejected with actionable errors before a report is marked successful.
- **SC-009**: Forecasts without the approved minimum history are marked unavailable, and all shown forecasts include their basis and confidence.
- **SC-010**: In the prototype, forecasts are always labeled unavailable because forecast calculation is out of scope; no forecast value is shown.
- **SC-011**: PM narrative revisions, review decisions, settings, run metadata, and logs follow the stated one-year and 90-day retention periods; person-level capacity rows are never persisted.
- **SC-012**: The scheduled workflow uses the initial Monday 9:00 a.m. trigger as the reporting-period end even if an allowed transient retry runs later; missed weekly triggers are not replayed automatically.

## Assumptions

- The initial project key is `USF-PLAN`, reporting timezone is `America/New_York`, PM input deadline is Monday 8:30 a.m. Eastern, and scheduled generation is Monday 9:00 a.m. Eastern.
- Controlled exports remain supported while direct integrations are unavailable or unapproved.
- Source inputs and generated reports are stored locally under access-controlled directories; PostgreSQL stores metadata and structured application records.
- The application displays source and report status, while the existing Python worker remains responsible for report generation unless an approved architecture decision changes that boundary.
- A report may be partial when a non-required source is unavailable, provided missing or stale data is explicitly disclosed.
- The prototype has one local project manager; the Windows account controls local access, while the worker uses a separately stored internal service token.
- Windows Credential Manager is assumed to be an organization-approved secret store for the local prototype; no secret-store policy exception is implied.
- The Python worker claims scheduled work and submits results through loopback-only internal API endpoints; it does not connect directly to PostgreSQL.
- The web application and PostgreSQL are local prototype services; remote/multi-user production deployment is excluded.

## Open Decisions

All implementation-critical decisions for the single-user local prototype are resolved in this specification. Remaining items are future-scope decisions, not blockers to the prototype:

- Direct Jira/Git/Confluence/capacity integrations and their organization-approved identities are out of scope; use the defined CSV contracts.
- Enterprise authentication, role management, remote/multi-user access, and production hosting are out of scope; any remote exposure is prohibited.
- XLSX parsing is out of scope; the PM spreadsheet must be exported to the defined CSV format before import.
- Automated Confluence page-body summarization, deployment/release metrics, forecast calculations, and manual report generation are out of scope.
- SQL-level physical design, migrations, backup/recovery, high availability, production performance, and disaster recovery are out of scope for the local prototype.
- Mobile layouts, non-Edge browser certification, and formal accessibility conformance certification are out of scope; controls must still be keyboard-operable and use semantic labels.
- Automatic report distribution is out of scope and prohibited by the product requirements.
- Recovery of a missed scheduled run or a failed run caused by missing PM/Jira inputs is out of scope; the failure is recorded, the last successful artifact is preserved, and the next attempt occurs at the next scheduled weekly period.

Before any remote or production deployment, a future specification MUST define authentication and authorization, secret distribution, network security, database migration/backup/recovery, operational support, source connector contracts, forecast methodology, and data-retention approvals. Such deployment is blocked until those decisions are approved.

## Commit History
9aed5b8 feat(module17): add local startup and schedule safeguards
9d3b62e fix(module17): normalize PowerPoint package metadata
120e16f feat(module17): verify complete and partial end-to-end workflows
6cc818c feat(module17): add scheduled worker startup
30ed253 feat(module17): implement artifact promotion and retention
06e0d9e feat(module17): generate six-slide PowerPoint report
e3b258c feat(module17): implement report run lifecycle
ab7c223 feat(module17): implement report metric calculations
b626270 feat(module17): align remaining Jira CSV contracts
50ca660 feat(module17): enforce upload freshness and coverage
def41fb feat(module17): align Jira worklog CSV contract
8761364 feat(module17): enforce Jira status mappings
eccdef1 feat: complete prototype per specification.
2a27807 This is working as expected & looks fine to me to commit without any concern or issues
d750c5d This is working as expected & looks fine to me to commit without any concern or issues
e918558 commit at 27-Oct-2026
6e26277 docs: add implementation task breakdown
498a926 commit at 27-Oct-2026
7abbaf6 docs: add detailed SpecKit specification
930d9d1 commit at 27-Oct-2026 04:03 AM
16e89fa chore: project skeleton for prototype
b734ce3 Commit at 27-Oct-2026 at 00:50 AM
31dde41 Add Module 15 bulk processor test evidence
4b6bf2e Complete Module 15 bulk file processing
3e872f5 commit at 26-Oct-2026 11:07 PM IST
9742012 Merge branch 'main' of https://github.com/kishore-epam/jira-confluence-automation
eabf475 commit at 26-Oct-2026 10:42 PM IST
b20aad2 Add implementation backlog for USF-PLAN weekly status report
c59a46c commit
e8666b4 Changed work/module-13-report.md
0941fe4 Commit at 23 Oct2026 03:34 AM
df7e7d2 Commit at 23 Oct 2026 01:35 AM
921f9a5 Commit at 22 Oct 2026 10:30 PM
1534321 Commit date 22 Oct 2026 04:32 PM
64358c0 Commit date 22 Oct 2026 03:58 PM
0858c49 Refactor instruction files for single responsibility
6fdfdc7 commit 22 Oct 2026 by KPM
422f77a commit 22 Oct 2026 by KPM
a8682a8 Commit Date 22 Oct 2026 Add weekly status report backlog
3286be9 Add Instruction Toolkit and Copilot configuration
d5deadf Initial commit

## Commit Count
41

## Project Files
.github/copilot-instructions.md
.github/prompts/to-create-instructions.prompt.md
.github/prompts/to-create-status-report.prompt.md
.gitignore
.nvmrc
.vscode/mcp.json
.vscode/settings.json
BACKLOG.md
README.md
backend/.gitkeep
backend/package-lock.json
backend/package.json
backend/src/schema.sql
backend/src/server.js
backend/test/server.test.js
compound_interest.py
config/.gitkeep
data/inputs/.gitkeep
data/reports/.gitkeep
docker-compose.yml
frontend/.gitkeep
frontend/index.html
frontend/package-lock.json
frontend/package.json
frontend/src/App.jsx
frontend/src/main.jsx
frontend/src/styles.css
frontend/vite.config.js
instructions/calculate-compound-interest.agent.md
instructions/calculate-issue-aging/SKILL.md
instructions/calculate-sprint-metrics/SKILL.md
instructions/create-agent-skills.agent.md
instructions/create-status-report.agent.md
instructions/creating-instructions.agent.md
instructions/load-jira-export/SKILL.md
instructions/main.agent.md
instructions/use-calculate_issue_aging.agent.md
instructions/use-calculate_sprint_metrics.agent.md
instructions/use-load_jira_export.agent.md
instructions/validate-instructions.agent.md
instructions/validate-project-source-exports.agent.md
packages/contracts/.gitkeep
scripts/register-local-startup-task.ps1
scripts/register-local-worker-task.ps1
scripts/run-local-report-worker.ps1
scripts/start-local-backend.ps1
scripts/start-local-database.ps1
scripts/start-local-services-on-logon.ps1
services/report-worker/.gitkeep
spec/analyze.md
spec/clarify.md
spec/constitution.md
spec/plan.md
spec/specification.md
spec/tasks.md
tests/.gitkeep
tools/bulk_file_processor.py
tools/compound_interest.py
tools/mcp-echo.ps1
tools/mcp-workspace-inspector.ps1
tools/module15_test_rules.json
tools/normalize_text_processor.py
work/TODO.md
work/module-03-report.md
work/module-08-report.md
work/module-09-report.md
work/module-10-report.md
work/module-12-report.md
work/module-12-skill-validation.md
work/module-13-report.md
work/module-14-report.md
work/module-15-report.md
work/module-16-report.md
work/module15-results/calculate-compound-interest.agent.validation.md
work/module15-results/calculate-issue-aging-SKILL.validation.md
work/module15-results/calculate-sprint-metrics-SKILL.validation.md
work/module15-results/create-agent-skills.agent.validation.md
work/module15-results/create-status-report.agent.validation.md
work/module15-results/creating-instructions.agent.validation.md
work/module15-results/load-jira-export-SKILL.validation.md
work/module15-results/main.agent.validation.md
work/module15-results/use-calculate_issue_aging.agent.validation.md
work/module15-results/use-calculate_sprint_metrics.agent.validation.md
work/module15-results/use-load_jira_export.agent.validation.md
work/module15-results/validate-project-source-exports.agent.validation.md
work/module15-script-test-output/sample-one.md.result.json
work/module15-script-test-output/sample-two.md.result.json
work/module15-test-input/sample-one.md
work/module15-test-input/sample-two.md
work/reports/example.md
work/reports/instructions.md
work/reports/template.md
work/reports/weekly-status-2026-10-18.pptx
