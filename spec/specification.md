# Feature Specification: USF-PLAN Weekly Status Reporting Platform

**Feature Branch**: Not assigned
**Created**: 2026-10-27
**Status**: Draft
**Input**: Module 08 requirements in `work/module03-task/project_spec.md`, the project constitution in `spec/constitution.md`, and the approved project stack.

## Overview

Build a project-manager-facing application and scheduled report-generation workflow for preparing a concise, client-safe weekly USF-PLAN status report. The product collects approved inputs, identifies source freshness and gaps, calculates the specified measures, generates a 5–7 slide PowerPoint, and makes the result available for project-manager review.

The primary application user is the USF-PLAN project manager. Executive leadership, the client/sponsor, and delivery leads are report recipients. The application must not email, publish, or otherwise distribute reports automatically.

The approved application stack is React 18.3.1 with Vite 7.3.7, Node.js 24.22.1 LTS with Express 5.3.0, and PostgreSQL 15 using Docker Compose v2. Report generation remains Python 3.12 and runs on a Windows Scheduled Task, as required by the source specification. The integration boundary between the web application and the Python worker is an open design decision.

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

**Why this priority**: Controlled Jira, Git, Confluence, capacity, and PM-template exports are the specified fallback until direct integrations are approved and available.

**Independent Test**: Submit a valid controlled export and an invalid export; verify that the valid input is recorded with its source and freshness metadata and that the invalid input returns actionable validation errors.

**Acceptance Scenarios**:

1. **Given** a supported controlled export and its source type, **When** the project manager uploads it, **Then** the application validates it against the configured source contract and reports whether it is usable.
2. **Given** an invalid, unsupported, or ambiguous export, **When** it is submitted, **Then** the application reports the source-specific validation failure and does not mark the input ready.
3. **Given** a previously accepted export, **When** a newer export is accepted for the same source and reporting window, **Then** the application identifies the newer input as current and preserves provenance for the report run that used the earlier input.
4. **Given** an export or import error contains sensitive values, **When** the application logs or displays the error, **Then** credentials and unnecessary personal data are not exposed.

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
2. **Given** valid current data and project-manager inputs, **When** generation succeeds, **Then** the worker creates a dated 5–7 slide PowerPoint and updates the `latest` copy under the configured output directory.
3. **Given** optional deployment/release data has no approved source, **When** generation completes, **Then** the metric is omitted or clearly labeled unavailable.
4. **Given** the forecast history does not meet the approved reliability threshold, **When** generation completes, **Then** the forecast is marked unavailable and is not inferred from insufficient history.
5. **Given** a required input or reporting window is invalid, **When** the worker runs, **Then** it fails with an actionable error and preserves the previous successful dated and `latest` reports.
6. **Given** one or more non-required sources are unavailable, **When** enough valid inputs remain for a partial report, **Then** the worker may produce a partial report that clearly identifies every missing or stale source.

### User Story 5 - Review and retrieve a generated report (Priority: P1)

As the project manager, I want to inspect a completed report and retrieve its PowerPoint so I can approve it before manual distribution.

**Why this priority**: Human review is mandatory; automatic email or publishing is prohibited.

**Independent Test**: Create a completed report-run fixture and verify that the project manager can see its period, status, warnings, and report artifact, while no distribution action is offered.

**Acceptance Scenarios**:

1. **Given** one or more completed report runs, **When** the project manager opens report history, **Then** runs are listed with period, completion time, outcome, and source warnings.
2. **Given** a completed report artifact, **When** the project manager requests it, **Then** the application returns the corresponding local PowerPoint file without changing or distributing it.
3. **Given** a run failed, **When** the project manager opens its details, **Then** the application shows an actionable failure summary and whether the prior successful report was preserved.
4. **Given** a report is available, **When** the project manager reviews it, **Then** no automatic send, publish, approval bypass, or external-distribution control is presented.

### User Story 6 - Configure safe reporting thresholds (Priority: P2)

As an authorized project manager or administrator, I want to review and configure approved reporting thresholds and mappings so issue-aging rules can reflect agreed project policy.

**Why this priority**: The five-business-day stale-update and ten-calendar-day in-progress thresholds are explicitly configurable, while the initial values must remain visible and testable.

**Independent Test**: Set an authorized threshold, read it back, and verify that report calculations use it; reject invalid values without changing the prior configuration.

**Acceptance Scenarios**:

1. **Given** the current configuration, **When** an authorized user views reporting settings, **Then** the configured aging thresholds and status mappings are shown.
2. **Given** a valid approved threshold change, **When** it is saved, **Then** subsequent report runs use the new value and retain the value used by earlier runs in their run metadata.
3. **Given** an invalid threshold or mapping, **When** it is submitted, **Then** the application rejects it with a validation message and retains the previous configuration.

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
- **FR-012**: The system MUST produce a neutral stakeholder-oriented PowerPoint of 5–7 slides with the required measures, PM narrative, report period, freshness information, and missing-data warnings.
- **FR-013**: On each successful run, the system MUST save a dated report and update a `latest` copy under the configured local output directory; it MUST retain dated reports for one year.
- **FR-014**: On generation failure, the system MUST preserve the previous successful report and MUST report an actionable failure.
- **FR-015**: The system MUST make reports available for project-manager review and manual retrieval, and MUST NOT email, publish, or distribute them automatically.

### Privacy, security, and operations

- **FR-016**: The system MUST use least-privilege, read-only access for external source integrations.
- **FR-017**: The system MUST NOT store credentials in source code, database records, logs, source exports, or generated reports. Approved secrets MUST be held in an organization-approved secret store.
- **FR-018**: Client-facing reports MUST represent the delivery group in aggregate and MUST NOT include named planned or actual hours until explicit organizational approval is recorded.
- **FR-019**: The system MUST restrict source inputs and generated reports according to organizational policy and MUST NOT scan beyond configured project, repository, or Confluence allowlists.
- **FR-020**: The system MUST log execution time, source success/failure, and output location without logging secrets or unnecessary personal data.
- **FR-021**: The scheduled workflow MUST run every Monday at 9:00 a.m. `America/New_York`; PM input is due Monday at 8:30 a.m. Eastern.
- **FR-022**: The system MUST validate required inputs, configuration, access, and reporting-window boundaries and fail with an actionable error when required conditions are invalid.
- **FR-023**: The application MUST use React 18.3.1 and Vite 7.3.7, Node.js 24.22.1 LTS and Express 5.3.0, and PostgreSQL 15 through Docker Compose v2. The report worker MUST use Python 3.12 and Windows Task Scheduler unless an approved specification change replaces those requirements.
- **FR-024**: The system MUST retain the source provenance and configuration values needed to determine which inputs, thresholds, and mappings were used for each report run.
- **FR-025**: The system MUST NOT persist unnecessary person-level capacity or worklog details in report-facing data. Any operational need to retain such source detail requires an explicit privacy and retention decision.

## API Endpoints

The following is the proposed versioned REST contract between the React application and Express API. It describes the intended data flow, not an implemented service. JSON is used for request and response bodies except controlled file uploads. Every endpoint is subject to the authentication and authorization decision recorded under **Open Decisions**. Errors use a consistent response shape: `{ "error": { "code": "...", "message": "...", "details": [] } }`; responses MUST NOT include secrets.

| Method and path | Purpose and data flow |
|---|---|
| `GET /api/v1/dashboard` | Returns the current reporting period, PM-input completion/deadline state, latest report-run summary, source readiness summary, and warning counts. No raw source data or credentials are returned. |
| `GET /api/v1/project-updates?periodStart={date}&periodEnd={date}` | Returns the PM narrative record for the requested reporting interval, if one exists, together with validation/completion state. |
| `PUT /api/v1/project-updates/{periodEnd}` | Creates or replaces the PM update for a reporting period. Body: `ragStatus`, `ragRationale`, `accomplishments[]`, `risksAndBlockers[]`, `decisionsNeeded[]`, `nextWeekPriorities[]`, and `milestoneChanges[]`. The path date is the report-period end date in `America/New_York`; the API validates that content and period. |
| `GET /api/v1/sources` | Returns configured source types and safe readiness metadata: configured/approved state, latest successful retrieval/import time, coverage period, freshness state, and warnings. Never returns secret values. |
| `POST /api/v1/source-inputs/{sourceType}` | Accepts a controlled export as multipart form data, with optional reporting-period metadata. Supported source types are Jira, Git, Confluence, capacity plan, and PM template. The API validates the declared source type, records provenance and validation outcome, and stores accepted files in the access-controlled input area. Exact file formats and schemas are source-configuration decisions. |
| `GET /api/v1/source-inputs?periodStart={date}&periodEnd={date}` | Returns metadata and validation outcomes for inputs associated with a reporting interval; does not expose file contents unless separately authorized. |
| `GET /api/v1/report-settings` | Returns non-secret report settings, including aging thresholds, status mappings, reporting timezone, configured project scope, and forecast readiness/threshold state. |
| `PUT /api/v1/report-settings` | Updates validated, non-secret settings such as aging thresholds and status mappings for authorized users. It MUST NOT accept integration passwords or tokens. Changes are versioned so each run can identify the settings used. |
| `GET /api/v1/report-runs?limit={n}&cursor={token}` | Returns paginated run history with run ID, reporting interval, scheduled/start/end times, status, source warning summary, and artifact availability. |
| `GET /api/v1/report-runs/{runId}` | Returns run details, per-source success/failure/freshness, validation warnings, metric availability, output metadata, and actionable failure information. It MUST exclude secrets and unnecessary person-level data. |
| `GET /api/v1/report-runs/{runId}/artifact` | Streams the completed PowerPoint for an authorized project-manager review. The file remains in local report storage; this endpoint does not distribute it externally. |

### API data rules

- Dates and timestamps MUST include an explicit timezone or be interpreted using the documented `America/New_York` reporting rule. Persist run timestamps in UTC and preserve the reporting timezone and computed start/end instants.
- Source input responses MUST identify validation status and a safe error summary; they MUST NOT echo secret or unnecessary personal values.
- A report run MUST reference the exact PM update, accepted source inputs, and settings version it consumed.
- No endpoint may send, publish, or approve a report on behalf of the project manager.
- A manual report-generation endpoint is intentionally not defined because the source specification defines a Windows Scheduled Task. Adding on-demand generation requires an explicit product decision.

## UI Screens

### 1. Weekly dashboard

Shows the current reporting window and timezone; PM input deadline and completion state; source readiness summary; latest run status; report availability; and prominent stale/missing-source warnings. It links to the relevant input, source, and report details. It does not expose secret values or named capacity data.

### 2. Project-manager weekly update

Provides fields for RAG status and rationale, accomplishments, risks/blockers, decisions needed, next-week priorities, and milestone changes. Displays the applicable reporting period, Monday 8:30 a.m. Eastern deadline, validation errors, and saved/unsaved state. It distinguishes missing required narrative from optional content.

### 3. Source inputs and validation

Allows the project manager to select a configured source and reporting period, submit a controlled export, and view validation results, coverage, provenance, and freshness. It displays accepted, rejected, stale, and superseded input states. It must not display credentials or expose raw person-level capacity in client-facing views.

### 4. Source readiness

Lists Jira, Git hosting, Confluence, capacity-planning, and PM-template sources, including only approved project/repository/space scope. Shows configured/approved state, last successful retrieval or import, coverage, freshness, and actionable errors. Missing deployment/release configuration is identified as optional/unavailable.

### 5. Report history and run details

Lists reports by period, status, and completion time. A run-detail view shows its reporting window, source outcomes and freshness, warnings, metrics unavailable, failure summary, and whether a previous successful report was preserved. An authorized project manager can retrieve a completed PowerPoint for review. There is no send, publish, or automatic distribution action.

### 6. Reporting settings

Shows and permits authorized edits to configurable issue-aging thresholds and approved status mappings, with validation and clear indication of the active settings. It displays project scope, timezone, and forecast configuration as read-only or editable only according to approved setup decisions. It does not accept or reveal secrets.

## Data Model

The following are logical PostgreSQL entities. They define what the product needs to persist, not a finalized physical schema. Generated PowerPoint files and controlled source files remain in the configured access-controlled local filesystem; PostgreSQL stores metadata and references, not file contents. Secrets remain in an approved secret store.

### Project

- `project_id` (primary key)
- `project_key` (unique; initially `USF-PLAN`)
- `display_name`
- `reporting_timezone` (initially `America/New_York`)
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
- `rag_status` (Red, Amber, or Green)
- `rag_rationale`
- `accomplishments`, `risks_and_blockers`, `decisions_needed`, `next_week_priorities`, `milestone_changes` (structured text/list values)
- `submitted_at`, `updated_at`
- `submitted_by` (user reference only after authentication design is approved)

PM narrative may contain sensitive project information and MUST receive access controls equivalent to the report. It MUST NOT contain credentials.

### SourceInput

- `source_input_id` (primary key)
- `project_id`, `period_id` (foreign keys where period is known)
- `source_type` (Jira, Git, Confluence, capacity plan, or PM template)
- `input_mode` (controlled export or approved connector)
- `storage_key` (opaque local-file reference; no secret-bearing paths)
- `content_hash`, `received_at`
- `coverage_start`, `coverage_end`
- `validation_status` and safe `validation_summary`
- `supersedes_source_input_id` (nullable self-reference)

Do not store raw file contents in database rows. Avoid retaining original filenames when they may contain personal data. Source files are access-controlled, retention-limited, and excluded from client-facing responses.

### ReportSettingsVersion

- `settings_version_id` (primary key)
- `project_id` (foreign key)
- `issue_stale_business_days` (initially 5)
- `in_progress_stale_calendar_days` (initially 10)
- `status_mapping` (configured mapping)
- `forecast_history_threshold` (nullable until agreed)
- `configuration` (validated, non-secret project/report settings)
- `effective_at`, `created_at`, `created_by`

Passwords, access tokens, and private keys MUST NOT be included in this entity.

### ReportRun

- `report_run_id` (primary key)
- `project_id`, `period_id`, `settings_version_id` (foreign keys)
- `project_update_id` (foreign key to the exact PM update consumed by this run)
- `trigger_type` (scheduled; other values require an approved extension)
- `status` (queued, running, succeeded, partial, or failed)
- `scheduled_at`, `started_at`, `completed_at`
- `worker_version`
- `failure_code` and safe `failure_summary` (nullable)
- `previous_success_preserved` (boolean)

Each run references the precise PM update it consumed and its source inputs through the association below.

### ReportRunInput

- `report_run_id`, `source_input_id` (composite primary key and foreign keys)
- `input_role`
- `consumed_at`

### ReportSourceResult

- `source_result_id` (primary key)
- `report_run_id` (foreign key)
- `source_type`
- `status` (succeeded, stale, unavailable, failed, or not configured)
- `coverage_start`, `coverage_end`, `retrieved_at`
- `warning_code` and safe `warning_summary`

### ReportArtifact

- `artifact_id` (primary key)
- `report_run_id` (foreign key)
- `artifact_kind` (dated or latest)
- `storage_key` (local filesystem reference)
- `content_hash`, `created_at`
- `retention_until`

The database stores the artifact reference and integrity metadata, not the PowerPoint bytes. The local artifact directory is access-controlled and follows the one-year dated-report retention requirement.

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
- A report period has at most one current project update and can be referenced by multiple report runs.
- Each report run uses one settings version and may reference multiple source inputs and per-source results.
- Each report run references the precise project update used to render its narrative.
- A successful or partial report run may have dated and `latest` artifact references.
- Metrics and source results belong to a single report run.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A scheduled Monday 9:00 a.m. Eastern run selects exactly the immediately preceding seven days in `America/New_York` and includes the active fixed Scrum sprint.
- **SC-002**: A successful run creates a readable PowerPoint containing 5–7 slides and all required available measures and PM narrative.
- **SC-003**: Every missing, stale, failed, or unavailable source used by a partial report is visibly identified in the report and run details.
- **SC-004**: Client-facing report output contains aggregate planned and actual capacity only and contains no named planned or actual hours unless explicit organizational approval is recorded.
- **SC-005**: No report is emailed, published, or distributed automatically; each report is available for project-manager review before manual distribution.
- **SC-006**: A failed generation leaves the prior successful report artifact unchanged and reports an actionable failure.
- **SC-007**: Dated successful reports remain available for one year, and a successful run updates the `latest` report.
- **SC-008**: Invalid required inputs and invalid reporting-window boundaries are rejected with actionable errors before a report is marked successful.
- **SC-009**: Forecasts without the approved minimum history are marked unavailable, and all shown forecasts include their basis and confidence.

## Assumptions

- The initial project key is `USF-PLAN`, reporting timezone is `America/New_York`, PM input deadline is Monday 8:30 a.m. Eastern, and scheduled generation is Monday 9:00 a.m. Eastern.
- Controlled exports remain supported while direct integrations are unavailable or unapproved.
- Source inputs and generated reports are stored locally under access-controlled directories; PostgreSQL stores metadata and structured application records.
- The application displays source and report status, while the existing Python worker remains responsible for report generation unless an approved architecture decision changes that boundary.
- A report may be partial when a non-required source is unavailable, provided missing or stale data is explicitly disclosed.
- Authentication, authorization roles, deployment topology, and the worker-to-API/database handoff have not yet been selected.

## Open Decisions

- **Authentication and authorization**: Select the organization-approved sign-in mechanism, project-manager role assignment, and authorization policy before exposing the API or reports.
- **Worker integration**: Decide how the Python 3.12 Windows Scheduled Task obtains validated PM updates, source inputs, and settings, reports run status, and records artifact metadata with the Node.js/Express application and PostgreSQL.
- **Direct integrations**: Confirm Jira endpoint and board, status mapping and blocker convention; Git provider and repository allowlist; Confluence project space/allowlist; capacity-planning provider; and approved read-only identities.
- **Export contracts**: Define supported CSV/XLSX schemas, date/time semantics, freshness thresholds, and required fields for each controlled source.
- **Forecasting**: Agree on the minimum reliable history threshold, forecast method, and confidence calculation.
- **Authentication for local artifacts**: Define how the API safely authorizes artifact download and how local file paths are resolved without path traversal.
- **Retention**: Confirm retention periods and secure deletion for source exports, PM updates, operational run metadata, and logs; the dated report retention period is one year.
- **Manual runs**: The initial API omits an on-demand generation endpoint to preserve the scheduled-only requirement. Decide separately whether authorized manual runs are needed.
- **Capacity privacy**: Confirm whether person-level source exports may be processed transiently, how to aggregate them, and whether any person-level source data may be retained.
- **Deployment/release source**: Identify and approve a source before including this optional metric.
- **Runtime deployment**: Confirm hosting, network/VPN requirements, backup/recovery, PostgreSQL volume retention, and whether the Node.js web application runs on the project manager's Windows machine or elsewhere.
