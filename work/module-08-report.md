# Module 08 Completion Report

## Tracked Files
```text
.gitignore
README.md
calculator.py
main.py
project_spec.md
```

## Spec Commit History
```text
3d9e44e (HEAD -> master) Add USF-PLAN weekly report specification
```

## project_spec.md Contents
````markdown
# USF-PLAN Automated Weekly Status Report

**Specification status:** Requirements draft  
**Prepared:** 2026-10-22  
**Project:** USF-PLAN  
**Requested file location:** `work/module03-task/project_spec.md`

## 1. Purpose

Produce a concise, repeatable weekly PowerPoint status report for the project manager overseeing 36 people on USF-PLAN. The report should help executives, the client/sponsor, and delivery leads understand project health, recent change, upcoming work, and items needing attention.

## 2. Audience and Sharing

- Primary audience: executive leadership, client/sponsor, and delivery leads.
- Represent the 36 people as one combined delivery group.
- The client-facing deck may include USF-PLAN Jira issue keys and titles; the user confirmed all project issue titles are approved for sharing.
- Do not include named planned or actual hours in the client-facing deck until organizational approval is confirmed. Report capacity as aggregate totals.
- The project manager must review and approve the generated deck before manual distribution. The automation must not email or publish it automatically.

## 3. Reporting Scope and Measures

The report covers both activity during the rolling seven-day window and the current active sprint. USF-PLAN uses fixed Scrum sprints.

Required measures and content:

- Overall Red/Amber/Green health, selected by the project manager with rationale.
- Sprint committed, completed, and remaining story points.
- Issue status and aging; flag issues with no update for five business days and issues in progress for more than ten calendar days. Keep thresholds configurable.
- Blockers, dependencies, scope changes, and milestone health.
- Jira milestones from project versions or roadmap data.
- Git commit counts across all project repositories.
- Deployment/release activity when its source is identified and available; this metric is optional until then.
- Weekly actual hours from Jira worklogs compared with planned weekly allocation from the capacity-planning tool. Jira issue estimates are not weekly allocations and must be shown separately from weekly planned hours.
- Delivery forecasts only when the underlying history is sufficiently reliable. Show the basis and confidence; otherwise mark the forecast unavailable. The minimum history threshold remains a setup decision.
- Manual PM updates for overall RAG and rationale, accomplishments, risks/blockers, decisions needed, next-week priorities, and milestone changes.

## 4. Data Sources

| Source | Required data | Scope and open configuration |
|---|---|---|
| Jira | Issue changes/status, sprint scope and points, blockers/dependencies, milestones, worklogs, and issue keys/titles | Company-managed Jira; project key supplied as `USF-PLAN`. Confirm API endpoint, board ID, workflow status mapping, and blocker convention. |
| Git hosting | Commit counts across all project repositories | Git provider and repository inventory are not yet known; configure the provider and repository allowlist during setup. |
| Confluence | Project plans and decisions | Include USF-PLAN project documentation only. The Confluence space/location is not yet known and must be configured; do not scan the entire site by default. |
| Capacity-planning tool | Planned weekly hours by person | Product is not yet identified. Support a controlled CSV/XLSX export as a fallback; make the direct connector configurable. |
| PM Excel template | RAG rationale, accomplishments, risks, decisions, priorities, and milestone changes | Completed by the project manager by Monday 8:30 a.m. Eastern. |

Use read-only integration access. Until direct integrations are approved and available, permit controlled exports as inputs. Do not embed credentials or tokens in source code, spreadsheets, or generated decks. Store approved secrets in an organization-approved secret store, such as Windows Credential Manager.

## 5. Report Format

- Format: neutral, stakeholder-oriented PowerPoint deck; no existing corporate template is required.
- Length: 5–7 slides.
- Suggested sections: executive summary and RAG; sprint progress and scope changes; milestones and qualified forecasts; issue aging, blockers, dependencies, and decisions; aggregate capacity; Git commits and optional deployments; next-week priorities.
- Generate a client-safe deck with aggregate capacity. Named hours remain excluded pending approval.
- If a source is unavailable or stale, generate using available data and clearly identify the missing source and data freshness. Do not silently substitute stale values.

## 6. Schedule and Output

- Implementation language: Python.
- Runtime: Windows Scheduled Task on the project manager's computer. The computer is expected to be powered on and connected to the corporate network/VPN at run time.
- Schedule: every Monday at 9:00 a.m. `America/New_York`.
- Reporting interval: the seven days immediately preceding generation, ending at the generation time, interpreted in `America/New_York`.
- PM input deadline: Monday at 8:30 a.m. Eastern.
- Output: save locally under the configured project output directory, initially `reports/`.
- Create a dated deck and update a `latest` copy on each successful run. Retain dated decks for one year.
- Generation only; no automatic delivery. The project manager manually reviews and distributes the approved deck.

## 7. Processing and Reliability

1. Load configuration and validate required inputs and access.
2. Collect Jira, Git, Confluence, capacity, and PM-template data for the reporting interval and current sprint.
3. Normalize Jira statuses and dates using configured mappings and the Eastern time zone.
4. Calculate the agreed metrics, keeping weekly allocations distinct from issue-level estimates.
5. Generate the PowerPoint and include source freshness, missing-data warnings, and report period.
6. Save the dated and latest outputs; preserve the previous successful deck if generation fails.

The job should log execution time, source success/failure, and output path without logging secrets or unnecessary personal data. A partial report is acceptable if it clearly marks unavailable or stale source data. Invalid required inputs or an invalid reporting window should fail with an actionable error.

## 8. Security and Privacy

- Use least-privilege, read-only access for source integrations.
- Keep secrets outside the repository and report files.
- Restrict access to the local output and input folders according to organizational policy.
- Show aggregate capacity in the client-facing report until explicit approval permits named-hour disclosure.
- Require project-manager review before external distribution.
- Treat issue titles as client-shareable per the user's confirmation, while retaining normal access controls for source systems.

## 9. Acceptance Criteria

- A scheduled run on Monday at 9:00 a.m. Eastern selects exactly the preceding seven days and includes the active sprint.
- The deck contains the required measures and PM-provided narrative in 5–7 readable slides.
- The report shows aggregate planned and actual hours; it does not expose named hours to client recipients before approval.
- A missing or stale source is visibly identified, and available sources still produce a usable deck.
- Deployment/release content is omitted or labeled unavailable until its source is configured.
- Outputs include a dated file and latest copy; dated files are retained for one year.
- No email or automatic publishing occurs; PM approval is required before distribution.
- Credentials are not present in source, logs, or the PowerPoint output.

## 10. Dependencies and Open Decisions

- Confirm the Jira API endpoint and project key validity, Scrum board ID, status mapping, and blocker field/status convention.
- Identify the Git hosting provider and all USF-PLAN repositories.
- Identify the Confluence space or project-document allowlist.
- Identify the capacity-planning product and its direct API/export format.
- Identify the deployment/release event source; until then this metric is optional.
- Confirm IT-approved read-only identities, network/VPN access, and secure local secret storage. Begin with approved exports if direct access is not ready.
- Agree on the minimum data-history threshold for forecasts and the forecast method.
- Confirm the local output folder is approved for project and client material.
- Confirm the PM Excel template location and the weekly allocation export handoff.
````