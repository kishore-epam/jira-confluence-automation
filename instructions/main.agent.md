# Instructions Catalog

Each entry below is an instruction file with a one-line description. Optional sub-fields:
- **Keywords** — trigger words/phrases: if a user's request matches, load this instruction.
- **Target** — file glob pattern: if the current file or context matches, consider this instruction relevant.
- **Exceptions** — edge cases or clarifications.

---

- [`./creating-instructions.agent.md`](./creating-instructions.agent.md) — Create or update project instructions, catalogs, bootstrap setup, and IDE integrations.
  + Keywords: create an instruction, update an instruction, instruction infrastructure, instruction catalog, Copilot prompt, bootstrap project instructions
- [`./create-agent-skills.agent.md`](./create-agent-skills.agent.md) — Create reusable Agent Skills with scripts, metadata, assets, and catalog integration.
  + Keywords: create a skill, create an agent skill, reusable skill, skill metadata
- [`./create-status-report.agent.md`](./create-status-report.agent.md) — Generate concise weekly status reports in Markdown with Accomplishments, Blockers, and Next Week sections.
  + Keywords: weekly status report, status update, accomplishments, blockers, next week
- [`./validate-project-source-exports.agent.md`](./validate-project-source-exports.agent.md) — Validate user-supplied local Jira or Confluence exports against supplied schemas and rules.
  + Keywords: validate export, Jira export, Confluence export, source freshness, reporting window
  + When to use: Check local project exports before report preparation; do not access live services or modify source files.
  + Required inputs: Local export files and source type; schema, required columns, and value constraints; reporting period and boundary conventions; time zone; freshness threshold and as-of field.
- [`./load-jira-export/SKILL.md`](./load-jira-export/SKILL.md) — Load controlled local Jira exports into normalized JSON with validation, freshness, and provenance (test-only).
  + Keywords: load Jira export, normalized Jira JSON, controlled export, Jira freshness
- [`./calculate-sprint-metrics/SKILL.md`](./calculate-sprint-metrics/SKILL.md) — Calculate frozen-baseline sprint progress, scope events, and estimate changes (test-only).
  + Keywords: sprint metrics, sprint progress, committed points, scope additions, scope removals
- [`./calculate-issue-aging/SKILL.md`](./calculate-issue-aging/SKILL.md) — Calculate business-day update age and continuous in-progress age with explicit evidence (test-only).
  + Keywords: issue aging, stale issues, business days, in-progress duration
