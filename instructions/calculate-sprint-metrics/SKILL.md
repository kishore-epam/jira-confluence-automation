---
name: calculate-sprint-metrics
description: "Use when calculating Jira sprint progress, frozen commitment, completion, remaining points, estimate changes, or scope additions/removals from normalized exports. Currently synthetic-test only."
version: "0.1.0"
---

# Calculate Sprint Metrics

- Read the [contract and synthetic rules](../../work/module03-task/JIRA_TOOLS.md).
  Use the [calculator](../../work/module03-task/tools/calculate_sprint_metrics.py)
  only with test-only normalized loader output and the identical rules file.
- Confirm an explicit sprint ID, frozen sprint-start baseline, current snapshot,
  evaluation time, and the history needed for the requested metrics. Do not
  choose an active sprint, baseline, completion policy, or point valuation by
  guessing. Production rules remain blocked pending approval.
- From the project root `work\module03-task`, run:
  ```powershell
  python .\tools\calculate_sprint_metrics.py --test-only `
    --input <normalized-json-path> --sprint-id SYNTHETIC-1 `
    --rules .\tests\fixtures\jira\synthetic-rules.json
  ```
- Use `--input -` for UTF-8 stdin if needed. Default output is JSON on stdout;
  `--output <approved-new-local-path>` is optional and never overwrites.
- Follow the approved synthetic rules: baseline points stay frozen; Done at
  observation means completed; reopened work is not completed. Removed,
  known non-Done baseline work remains baseline remaining. Show current-scope
  totals separately. Do not silently refresh the baseline.
- Distinguish net snapshot additions/removals from gross history events.
  Complete baseline-to-current history is required for gross events.
  Report retained-issue estimate changes separately from membership changes.
- Present **TEST ONLY**, sprint ID, baseline/current timestamps, committed,
  completed and remaining baseline points, separate current-scope totals,
  net changes, gross events when available, and estimate changes.
- Retain source freshness, provenance, rule/input hashes, and all inherited
  warnings. Label partial known-only totals; unknown is not zero. Do not invent
  scope history from snapshots or imply old snapshots describe current state.
- Handle exits `0`/`3`/`2`/`1` as evaluated/partial/invalid/I/O-runtime failure.
  Never suppress incomplete metrics or present failed runs as successful.
- Use local sanitized fixtures only. Do not access services or credentials,
  alter inputs, publish, stage, commit, or modify unrelated report code.
