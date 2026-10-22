# Instructions Catalog

Each entry below is an instruction file with a one-line description. Optional sub-fields:
- **Keywords** — trigger words/phrases: if a user's request matches, load this instruction.
- **Target** — file glob pattern: if the current file or context matches, consider this instruction relevant.
- **Exceptions** — edge cases or clarifications.

---

- [`./creating-instructions.agent.md`](./creating-instructions.agent.md) — Create or update project instructions, catalogs, and IDE integrations.
  + Keywords: create an instruction, update an instruction, instruction infrastructure, instruction catalog, Copilot prompt
- [`./create-status-report.agent.md`](./create-status-report.agent.md) — Generate concise weekly status reports in Markdown with Accomplishments, Blockers, and Next Week sections.
  + Keywords: weekly status report, status update, accomplishments, blockers, next week
- [`./validate-project-source-exports.agent.md`](./validate-project-source-exports.agent.md) — Validate user-supplied local Jira or Confluence exports against supplied schemas and rules.
  + Keywords: validate export, Jira export, Confluence export, source freshness, reporting window
  + When to use: Check local project exports before report preparation; do not access live services or modify source files.
  + Required inputs: Local export files and source type; schema, required columns, and value constraints; reporting period and boundary conventions; time zone; freshness threshold and as-of field.
