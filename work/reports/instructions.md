# How to Complete the Weekly Status Report

Start with [template.md](template.md). Replace every bracketed prompt with verified information. Keep the report brief, factual, and understandable to executives, the client/sponsor, and delivery leads.

## 1. Set the Reporting Window

- Enter the report date and active sprint name and dates.
- Use the seven days immediately before the report is generated. Record the exact start and end timestamps in `America/New_York` (Eastern Time), including the time zone. The active sprint measures cover the current sprint, even when it began before the reporting window.
- The report is prepared for Monday at 9:00 a.m. Eastern. Gather and review the project manager's updates by 8:30 a.m. Eastern.

## 2. Summarize Health and Progress

- Choose one overall status: **Green** means the plan is on track; **Amber** means there is a material concern that needs attention; **Red** means a key outcome or milestone is at risk or blocked. Use project judgment and explain the reason; do not infer health from a single metric.
- List the week's most important completed outcomes. Describe observable results rather than general activity.
- Report the active sprint's committed, completed, and remaining story points using the same agreed source and definitions. Note additions or removals from sprint scope and why they changed.
- Report milestone target dates, health, and changes. Include a delivery forecast only when the project has enough reliable history; state its basis and confidence. Otherwise write that it is unavailable due to insufficient reliable history.

## 3. Capture Risks and Actions

- Include material risks, blockers, dependencies, and decisions needed. State the impact, next action, responsible role, and due date. Write `None` when there are no material items.
- Flag issues with no update for **five business days or more** and issues that have been in progress for **more than ten calendar days**. Include the issue key, age, and next action. Apply configured project thresholds if they differ, and say when you do.
- Keep issue status and aging grounded in the reporting data. Do not treat an unverified assumption as a fact.

## 4. Report Capacity and Activity

- Show planned weekly allocation and actual worklog hours as **aggregate totals only**. Do not include names or person-level hours in a client-facing report unless the organization has explicitly approved that disclosure for the audience.
- Keep planned weekly allocation from the capacity-planning source separate from Jira issue estimates. Issue estimates are not weekly allocations; do not substitute one for the other.
- Count Git commits across all configured project repositories and state the repository scope and data freshness.
- Include deployment or release activity only if a source is configured and available. Otherwise mark it unavailable; do not imply that no deployments occurred.

## 5. Record Sources and Review

- For each source, mark it `Current`, `Stale`, or `Unavailable`; include its as-of date or reporting window and explain any gap. Never silently fill a gap with stale data or a guess.
- A partial report is acceptable when a source is missing, provided the gap is clearly disclosed and the available information remains useful. Use `N/A` or `Unavailable` instead of inventing a number.
- Before sharing, check dates, totals, issue references, milestone changes, and audience suitability. The project manager must review and approve the report before manual distribution. Do not email or publish it automatically.
- Keep credentials and secrets out of the report. Follow organizational access controls for project and client material.

## Final Check

- No bracketed prompts remain.
- Reporting period, sprint, units, and source freshness are clear.
- Capacity is aggregated, and issue estimates are not presented as planned weekly hours.
- Missing or stale information is disclosed; unsupported forecasts are marked unavailable.
- PM review is recorded as pending or approved before distribution.