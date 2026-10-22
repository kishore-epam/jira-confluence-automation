---
name: calculate-issue-aging
description: "Use when calculating Jira issue aging, business days without updates, continuous in-progress duration, or aging flags from normalized exports. Currently synthetic-test only."
version: "0.1.0"
---

# Calculate Issue Aging

- Read the [contract and synthetic rules](../../work/module03-task/JIRA_TOOLS.md).
  Use the [calculator](../../work/module03-task/tools/calculate_issue_aging.py)
  with test-only normalized loader output and the identical rules file.
- Confirm the evaluation timestamp, current snapshot, mapped statuses, update
  timestamps, and transition-history coverage. Ask for missing data or rules;
  do not guess production calendars, holidays, update semantics, or status maps.
- From the project root `work\module03-task`, invoke:
  ```powershell
  python .\tools\calculate_issue_aging.py --test-only `
    --input <normalized-json-path> `
    --rules .\tests\fixtures\jira\synthetic-rules.json
  ```
- Use `--input -` for UTF-8 stdin if needed. JSON goes to stdout unless
  `--output <approved-new-local-path>` is requested; never overwrite inputs.
- Apply the approved **test-only** calendar: America/New_York local dates,
  Monday-Friday, no holidays, `(last-update date, evaluation date]`.
  Flag nonterminal issues at `>=5` business days without update.
- In-progress age is local-date difference from the latest entry into the
  current continuous In Progress period; re-entry resets it. Flag only at
  `>10` calendar days. Require complete history from entry through observation.
  Never substitute creation/update time for missing transition evidence.
- Present **TEST ONLY**, evaluation/snapshot times, issue keys/titles/status,
  update and in-progress-start evidence, day counts, thresholds, and both
  flags. Explain unavailable versus inapplicable ages and partial results.
- Preserve freshness/provenance and inherited warnings. Never interpret missing
  timestamps or unavailable flags as "healthy." Do not invent impact or next action;
  these require explicit source data or PM input.
- Handle exits `0`/`3`/`2`/`1` as evaluated/partial/invalid/I/O-runtime failure.
  Report failures explicitly; do not claim unexecuted calculations succeeded.
- Use local sanitized data only; do not access services/credentials, modify
  inputs, publish, stage, commit, or change unrelated report code.
