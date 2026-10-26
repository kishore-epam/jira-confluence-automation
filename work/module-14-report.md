# Module 14 Completion Report

## Backlog Contents
```markdown
# USF-PLAN Weekly Status Report — Implementation Backlog

This backlog turns the requirements in [project_spec.md](project_spec.md) into
actionable work. The initial delivery path is controlled exports first, followed
by direct connectors after source owners, access, and formats are confirmed.
Tasks are ordered within each phase to expose dependencies. `[x]` means the
work is already implemented in the current project; it does not imply that the
full specification requirement is complete.

## Setup

- [ ] Confirm the Jira base URL, project key (`USF-PLAN`), Scrum board ID, and the
  approved read-only account or controlled-export process.
  - Implementation: [MCP + Custom Skill]
  - GitHub Issue: #2 https://github.com/kishore-epam/jira-confluence-automation/issues/2
- [ ] Document the Jira workflow status mapping, definition of "in progress,"
  blocker/dependency convention, and sprint scope-change rules.
  - Implementation: [MCP + Custom Skill]
  - GitHub Issue: #3 https://github.com/kishore-epam/jira-confluence-automation/issues/3
- [ ] Identify all Git hosting repositories in the project allowlist and define
  how local or hosted repository history will be refreshed.
- [ ] Identify the approved Confluence space or project-document allowlist;
  explicitly exclude site-wide searches.
  - Implementation: [MCP + Custom Skill]
  - GitHub Issue: #4 https://github.com/kishore-epam/jira-confluence-automation/issues/4
- [ ] Identify the capacity-planning product and agree on the controlled
  CSV/XLSX export format, reporting week, units, and aggregation rules.
- [ ] Locate the PM Excel input template and define required fields, allowed
  values, validation rules, and the Monday 8:30 a.m. ET handoff.
- [ ] Confirm the deployment/release event source; keep this source optional
  until an owner and approved data interface are identified.
- [ ] Agree on the minimum history and method required for a delivery forecast;
  until agreed, report forecasts as unavailable due to insufficient reliable
  history.
- [ ] Confirm the approved local input/output folders, access controls, retention
  owner, and storage location for client-facing material.
- [ ] Confirm IT-approved read-only identities, network/VPN prerequisites, and
  secret storage (for example, Windows Credential Manager); prohibit secrets in
  configuration files, exports, logs, and decks.
- [ ] Define a configuration schema for project key, timezone, reporting
  schedule, input/output paths, source allowlists, stale-data thresholds, and
  issue-aging thresholds; validate required values at startup.
- [x] Set up a Windows-compatible Python environment and dependency installation
  instructions for the report generator.
- [x] Extract local Git history and working-tree collection into
  `data_fetching.py` and connect it to the existing report generator.

## Core Features

- [ ] Define typed normalized data models for Jira issues, sprints, milestones,
  worklogs, Git activity, planned capacity, PM updates, and source freshness.
  - Implementation: [MCP + Custom Skill]
- [ ] Define source status values (`Current`, `Stale`, `Unavailable`) and ensure
  every collected dataset carries its as-of time/reporting window and any gap.
  - Implementation: [MCP + Custom Skill]
- [ ] Implement shared validation for required fields, date ranges, numeric
  measures, allowed status values, and malformed or incomplete source records.
  - Implementation: [MCP + Custom Skill]
- [x] Implement reporting-window calculation for the seven days immediately
  preceding the run, using `America/New_York` and exact start/end timestamps.
- [ ] Include the active sprint independently of the rolling weekly window and
  validate that its dates and sprint identity are available.
  - Implementation: [MCP + Custom Skill]
- [ ] Define the 5–7-slide deck structure: executive summary/RAG, sprint
  progress, milestones/forecast, issue aging/risks, aggregate capacity/activity,
  and next-week priorities/data freshness.
- [ ] Replace repository-demo labels and content with USF-PLAN project
  configuration and stakeholder-oriented report language.
- [ ] Implement a PM-input loader for overall RAG and rationale, accomplishments,
  risks/blockers, decisions, next-week priorities, and milestone changes.
- [ ] Validate that PM narrative is present or explicitly unavailable; do not
  infer health, risks, decisions, or priorities from Git activity.
- [ ] Calculate sprint committed, completed, and remaining story points using
  the agreed baseline and completion rules.
  - Implementation: [MCP + Custom Skill]
- [ ] Calculate and explain scope additions/removals without silently changing
  the sprint-start commitment baseline.
  - Implementation: [MCP + Custom Skill]
- [ ] Calculate issue aging using configurable thresholds: no update for at
  least five business days and in progress for more than ten calendar days.
  - Implementation: [MCP + Custom Skill]
- [ ] Include flagged issue keys, titles, status/age evidence, impact, and next
  action; do not treat unverified assumptions as facts.
  - Implementation: [MCP + Custom Skill]
- [ ] Include milestone target dates, health, and PM-reported changes; show a
  qualified forecast only after its configured history threshold is met.
  - Implementation: [MCP + Custom Skill]
- [ ] Calculate aggregate actual worklog hours and aggregate planned weekly
  allocation as separate measures and clearly distinguish both from issue
  estimates.
  - Implementation: [MCP + Custom Skill]
- [ ] Enforce a client-safe capacity model that excludes names and person-level
  hours from both report content and presentation metadata.
  - Implementation: [Custom Skill]
- [ ] Calculate Git commit counts across the configured repository allowlist and
  show repository scope and data freshness.
  - Implementation: [Custom Skill]
- [ ] Render optional deployment/release activity only when its source is
  configured and available; otherwise label it unavailable or omit it.
  - Implementation: [Custom Skill]
- [ ] Add an explicit data freshness and review section with source status,
  as-of/reporting period, gaps, and PM review state.
  - Implementation: [Custom Skill]
- [ ] Make unavailable or stale inputs visible while still generating a useful
  partial report from current available inputs.
  - Implementation: [Custom Skill]
- [ ] Write the dated PowerPoint and a `latest` copy only after successful
  generation; preserve the previous successful output if collection or
  generation fails.
- [ ] Retain dated report files for one year without deleting the latest copy or
  removing files outside the configured report directory.
- [ ] Log run time, source success/failure, and output path without logging
  credentials, named hours, or unnecessary personal data.
- [ ] Keep the workflow generation-only: require PM review before manual
  distribution and implement no email or automatic publishing.

## Integration

- [ ] Implement a controlled Jira export adapter for issue changes/status,
  sprint scope and points, blockers/dependencies, milestones, and worklogs.
  - Implementation: [Custom Skill]
- [ ] Implement Jira export freshness checks and report stale, missing, or
  inconsistent exports without substituting older values silently.
  - Implementation: [Custom Skill]
- [ ] Add a Jira API adapter only after endpoint, board, status mapping, access,
  and read-only authorization have been approved; share normalization logic
  with the export adapter.
  - Implementation: [MCP + Custom Skill]
- [ ] Implement a Git repository allowlist configuration and collect commits
  across every configured project repository, not only the report tool's own
  repository.
- [ ] Implement a Confluence project-document adapter scoped only to the
  approved USF-PLAN space or allowlist; support controlled exports until direct
  access is approved.
  - Implementation: [MCP + Custom Skill]
- [ ] Implement a capacity CSV/XLSX adapter that aggregates planned hours and
  drops person-level detail before data reaches report rendering.
  - Implementation: [Custom Skill]
- [ ] Add a direct capacity connector only after the product, approved API,
  read-only identity, and aggregation behavior are confirmed.
  - Implementation: [Custom Skill]
- [ ] Implement the PM Excel template reader and field validation for the
  required narrative and milestone updates.
  - Implementation: [Custom Skill]
- [ ] Implement a configurable deployment/release adapter only if a source and
  stakeholder-approved measure become available.
  - Implementation: [Custom Skill]
- [ ] Add a source registry so integrations can be enabled/disabled through
  configuration and disabled or unconfigured sources report `Unavailable`.
  - Implementation: [Custom Skill]
- [ ] Store integration secrets only in the approved secret store and resolve
  them at runtime without copying them into generated artifacts or logs.
  - Implementation: [Custom Skill]

## Testing

- [x] Add unit tests for reporting-window boundaries and daylight-saving-time
  behavior in `America/New_York`.
- [ ] Add unit tests for Monday scheduling behavior.
- [ ] Add tests for normalized source models, required-field validation,
  invalid windows, malformed exports, and actionable error messages.
  - Implementation: [MCP + Custom Skill]
- [ ] Test Jira status normalization, sprint baseline/scope changes, milestone
  changes, issue aging business-day/calendar-day thresholds, and worklog totals.
  - Implementation: [MCP + Custom Skill]
- [ ] Test CSV/XLSX aggregation, missing columns, stale data, invalid values, and
  proof that named planned/actual hours do not enter report-facing data.
- [ ] Test PM template parsing, missing required narrative, invalid RAG values,
  and pending/approved review-state rendering.
- [ ] Test Git collection for multiple repositories, date-boundary commits,
  empty repositories, uncommitted changes, and inaccessible repositories.
  - Implementation: [Custom Skill]
- [ ] Test source freshness states and partial-report generation for unavailable,
  stale, and failed sources.
  - Implementation: [Custom Skill]
- [ ] Test that an invalid run or failed generation leaves prior dated and
  `latest` outputs unchanged.
- [ ] Test one-year retention behavior using temporary output directories and
  verify cleanup is restricted to eligible dated reports in the configured
  directory.
- [ ] Add a deck-content test verifying required sections, 5–7 slides, issue
  references, aggregate-only capacity, source freshness, and review state.
- [ ] Inspect generated slides for clipping, overlap, readability, and sensible
  behavior with long issue titles and empty/large data sets.
- [ ] Add security/privacy checks that scan generated text and logs for
  credential-like values and named capacity fields.
- [ ] Add an end-to-end test using representative sanitized exports that
  generates both dated and `latest` decks without contacting live services.
  - Implementation: [Custom Skill]
- [ ] Verify the Windows Scheduled Task command, working directory, Python
  environment, permissions, VPN assumptions, Monday 9:00 a.m. ET trigger, and
  actionable failure logging.

## Documentation

- [ ] Update the README with setup, configuration, export preparation, local
  execution, and troubleshooting instructions.
- [ ] Document each controlled-export schema with column names, formats,
  timezones, units, required fields, and a sanitized example.
- [ ] Document configuration options, safe defaults, source enablement, staleness
  behavior, issue-aging thresholds, and forecast qualification rules.
- [ ] Document secret provisioning through the approved secret store and state
  explicitly that secrets must not be committed or placed in exports.
- [ ] Document the Windows Scheduled Task installation, run account, Monday
  9:00 a.m. ET schedule, VPN/network assumptions, and log/output locations.
- [ ] Document report review steps, aggregate-capacity privacy guarantees,
  PM approval, manual distribution, and the absence of automated publishing.
- [ ] Document partial-report interpretation, source freshness indicators,
  unavailable metrics, and how to resolve failed or stale sources.
- [ ] Document dated/latest output naming, one-year retention behavior, and
  recovery behavior after an unsuccessful run.
- [ ] Add a release checklist mapping each acceptance criterion in
  `project_spec.md` to its implementation and test evidence.

## MCP Strategy

- Prefer Atlassian Rovo MCP for standard Jira/Confluence operations when compatible with our Atlassian Cloud environment.
- Use custom skills for project-specific validation, normalization, calculations, formatting, and business rules.
- Combine MCP + custom skills when MCP retrieves data that requires project-specific processing.
- No MCP server is being installed or configured as part of this step.

## Decisions Made

- Use Python for the report generator and `python-pptx` for PowerPoint output,
  consistent with the project requirements and current implementation.
- Use controlled exports as the initial integration path; defer direct
  connectors until their source owners, access, and formats are confirmed.
- Calculate the reporting period as the exact rolling seven days ending at
  generation time, in `America/New_York`, rather than a previous complete
  Monday-Sunday week.
- Use Python's `zoneinfo` with the `tzdata` package so the IANA timezone is
  available on Windows. Normalize timezone-aware inputs to Eastern time;
  interpret dates and naive datetimes as Eastern time.
- Accept ISO-8601 dates and datetimes for reproducible runs. A date-only
  `--as-of` value represents midnight Eastern on that date.
- Keep report generation local and require project-manager review before
  manual distribution; do not send or publish reports automatically.
```

## GitHub Issues
| Issue URL | Title | Created via MCP? |
|-----------|-------|-----------------|
| https://github.com/kishore-epam/jira-confluence-automation/issues/2 | Confirm the Jira base URL, project key (`USF-PLAN`), Scrum board ID, and the approved read-only account or controlled-export process. | Yes |
| https://github.com/kishore-epam/jira-confluence-automation/issues/3 | Document the Jira workflow status mapping, definition of "in progress," blocker/dependency convention, and sprint scope-change rules. | Yes |
| https://github.com/kishore-epam/jira-confluence-automation/issues/4 | Identify the approved Confluence space or project-document allowlist; explicitly exclude site-wide searches. | Yes |

## MCP Tools Used
- mcp_github_mcp_se_get_me
- mcp_github_mcp_se_search_repositories
- mcp_github_mcp_se_list_repository_collaborators
- mcp_github_mcp_se_list_issues
- mcp_github_mcp_se_list_issue_types
- mcp_github_mcp_se_issue_write
- mcp_github_mcp_se_issue_read
- mcp_github_mcp_se_sub_issue_write
