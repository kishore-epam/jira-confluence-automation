# Use the Issue Aging Calculator

- Use this procedure when asked to calculate Jira issue update age, no-update
  thresholds, or continuous in-progress age from normalized Jira data.
- For every issue-aging request, run the actual
  `work\module03-task\tools\calculate_issue_aging.py` with the supplied
  normalized input and configuration. Do not estimate dates mentally, calculate
  ages conversationally, or substitute guessed transitions. Immediately check
  the process exit code and inspect the emitted JSON and warnings before
  reporting any result. If execution is unavailable, report **NOT RUN**.
- The tool is **TEST ONLY**: always pass `--test-only`, use only the approved
  `synthetic-v1` profile and sanitized local data, and do not represent results
  as production Jira reporting. Read the current `--help` before use:
  ```powershell
  Set-Location 'C:\workspace\hello-genai\work\module03-task'
  .\.venv\Scripts\python.exe -B .\tools\calculate_issue_aging.py --help
  ```

## Required input and counting policy

- `--input` is normalized `jira_export` JSON from the local Jira loader. It
  must carry the issue snapshot, source timestamps and freshness, normalized
  statuses, provenance, and history evidence or explicit `null`.
- Before invoking the aging CLI on loader output, require loader exit `0` or
  `3`, confirm that this run created the normalized output, and inspect its
  `context.as_of`, snapshot observation time, and warnings. Never reuse an old
  output after a failed load; the manifest loader requires a new, non-existing
  output path for each run. For fixed-as-of test cases, each issue timestamp
  must be no later than its snapshot's `observed_at`; source observation and
  history coverage/event timestamps must also be consistent with the case
  `--as-of`. If the loader rejects a case or no compatible normalized evidence
  exists, stop that case and report **NOT RUN** rather than invoking aging on a
  missing/stale file or adjusting evidence just to force an expected result.
- When preparing temporary manifest-based cases, validate every snapshot
  against its own observation time: in particular, baseline `created_at` and
  `updated_at` must be at or before the baseline snapshot's `observed_at`, not
  merely before the evaluation `--as-of`. Give every run/retry a fresh
  temporary directory and non-existing loader output path. Run a holiday-policy
  rejection check only after a valid normalized input has been produced; if
  setup fails, report that case **NOT RUN** instead of treating the setup error
  as the policy result.
- `--status-map` is a local JSON raw-status-to-category object matching the
  approved map exactly:
  ```json
  {
    "To Do": "todo",
    "In Progress": "in_progress",
    "Done": "done"
  }
  ```
  Only normalized `in_progress` is treated as in progress. A transition from
  another mapped category into `in_progress` starts the current period; leaving
  that category ends it. Reopening into `in_progress` starts a new period.
- `--as-of` is a required offset-bearing ISO-8601 timestamp and must match the
  normalized input's `context.as_of`. It cannot precede source issue updates or
  history events. `--timezone` defaults to `America/New_York` and must match
  the normalized context; the synthetic profile does not accept another zone.
- `--business-day-rule` is a required local JSON policy object. It must exactly
  declare schema version `1.0`, `test_only: true`, profile `synthetic-v1`,
  weekend days `[5, 6]`, interval `(start,end]`, and `holiday_policy: "none"`.
  This policy is the approved synthetic convention; do not silently change it.
- Business-day age counts Monday-Friday **local dates** in
  `(last-update local date, as-of local date]`. It excludes the starting date,
  includes the ending date, has no partial-day weighting, and does not exclude
  holidays. `--holidays` is optional and accepts only a JSON array of unique ISO
  `YYYY-MM-DD` dates. The selected policy does not approve holiday exclusions,
  so a non-empty list is rejected rather than used to alter the count. An empty
  array is permitted. If a required production calendar/holiday policy differs
  or is unspecified, request approval rather than choosing one.
- Continuous in-progress age is the difference between the evaluation's and
  latest valid entry transition's **New York local calendar dates**. It is not
  derived from creation or last-updated timestamps. Valid complete history must
  cover the latest transition through the current snapshot. Re-entry after a
  non-in-progress status resets the starting timestamp. An issue currently
  outside `in_progress` has no applicable continuous in-progress age.
- The synthetic thresholds default to five business days without update and ten
  calendar days in progress. A nonterminal issue breaches the no-update
  threshold at **`>= 5`** business days. An in-progress issue breaches the
  long-in-progress threshold only at **`> 10`** calendar days. These measures
  are evaluated separately; do not conflate their calendars or operators.

## CLI arguments

| Argument | Required | Meaning |
|---|---:|---|
| `--help` / `-h` | No | Display current CLI usage. |
| `--test-only` | Yes | Acknowledge synthetic data/policy; production use is blocked without it. |
| `--input` | Yes | Normalized `jira_export` JSON file or `-` for UTF-8 JSON stdin. |
| `--as-of` | Yes | Offset-bearing timestamp matching normalized `context.as_of`. |
| `--status-map` | Yes | Local JSON status mapping, exactly the approved synthetic map. |
| `--business-day-rule` | Yes | Local JSON weekday/interval/holiday policy object. |
| `--holidays` | No | Optional local JSON array of unique ISO dates; non-empty lists are rejected under current policy. |
| `--no-update-business-days` | No | Positive integer threshold; default `5`; breach comparison is `>=`. |
| `--in-progress-calendar-days` | No | Positive integer threshold; default `10`; breach comparison is `>`. |
| `--timezone` | No | Defaults to `America/New_York`; must match the normalized context. |
| `--output` | No | Local JSON result path; without it, result JSON is written to stdout. |

Use local paths only. Relative paths resolve from the current working directory.
The output parent directory must already exist; output cannot alias the input,
status map, rule file, or holidays file. Output uses atomic replacement after
validation, preserving an earlier result on fatal validation/write failure.
The calculator does not modify input or configuration files.

## Runnable sanitized-fixture example

Run this from `work\module03-task`. It first creates normalized JSON from the
existing invented local fixture set, then invokes the aging script. It places
all generated files in a unique temporary folder.

```powershell
$ErrorActionPreference = 'Continue'
Set-Location 'C:\workspace\hello-genai\work\module03-task'

$run = Join-Path $env:TEMP ('issue-aging-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $run | Out-Null
$normalized = Join-Path $run 'normalized.json'
$output = Join-Path $run 'issue-aging.json'
$loaderDiagnostics = Join-Path $run 'loader-stderr.jsonl'
$agingDiagnostics = Join-Path $run 'aging-stderr.jsonl'

.\.venv\Scripts\python.exe -B .\tools\load_jira_export.py --test-only `
  --manifest .\tests\fixtures\jira\manifest.json `
  --rules .\tests\fixtures\jira\synthetic-rules.json `
  --as-of 2026-10-22T09:00:00-04:00 `
  --window-start 2026-10-15T09:00:00-04:00 `
  --window-end 2026-10-22T09:00:00-04:00 `
  --timezone America/New_York `
  --output $normalized 2> $loaderDiagnostics
$loaderExit = $LASTEXITCODE
Write-Output "Loader exit code: $loaderExit"
if ($loaderExit -ne 0 -and $loaderExit -ne 3) {
  throw "Loader failed with exit code $loaderExit; inspect $loaderDiagnostics"
}

.\.venv\Scripts\python.exe -B .\tools\calculate_issue_aging.py --test-only `
  --input $normalized `
  --as-of 2026-10-22T09:00:00-04:00 `
  --status-map .\tests\fixtures\module12\status-map.json `
  --business-day-rule .\tests\fixtures\module12\business-day-rule.json `
  --holidays .\tests\fixtures\module12\holidays-empty.json `
  --no-update-business-days 5 `
  --in-progress-calendar-days 10 `
  --timezone America/New_York `
  --output $output 2> $agingDiagnostics
$agingExit = $LASTEXITCODE
Write-Output "Aging exit code: $agingExit"
if ($agingExit -ne 0 -and $agingExit -ne 3) {
  throw "Aging calculation failed with exit code $agingExit; inspect $agingDiagnostics"
}

$result = Get-Content -Raw $output | ConvertFrom-Json
$result | ConvertTo-Json -Depth 100
```

The loader may return `3` for usable normalized data with missing history or
baseline evidence. Inspect its validation and diagnostics before continuing;
the aging calculator can still produce update-age measures from a valid current
snapshot, while continuous in-progress age may be unavailable.

## Output, evidence, and data gaps

- The top-level result preserves normalized context, rules, warnings, source
  metadata/freshness, manifest provenance, and includes the consumed input
  SHA-256. `validation.result` is `Passed` or `Incomplete`.
- `data` identifies `as_of`, current `snapshot_id` and `observed_at`, thresholds,
  timezone/weekend/interval/holiday policy, and policy file hashes.
- Each issue includes its key, title, normalized status, `updated_at`,
  `in_progress_since`, supporting snapshot/update/transition timestamps,
  issue/transition provenance, separate metric objects, `breached_thresholds`,
  and `data_gaps`. Metric objects include `value`, `availability`,
  `reason_codes`, and evidence.
- The no-update age uses issue `updated_at`; missing update time gives an
  unavailable age and breach flag (except terminal Done issues, which do not
  breach no-update). The continuous in-progress age requires a valid latest
  entry into `in_progress` and complete history coverage through snapshot
  observation. Missing, partial, or uncovered history produces `null` with
  `Unavailable` and reason `continuous_in_progress_history_required`. Never
  substitute `created_at` or `updated_at` for a missing transition.
- A `null`/`Unavailable` measure is not zero. `Partial` results carry reasons.
  Inapplicable in-progress age is distinguished with `not_applicable`; it does
  not mean the issue has zero age.
- Preserve every inherited source freshness state (`Current`, `Stale`, or
  `Unavailable`), timestamp, and warning. A stale or older snapshot is not
  made current by calculation; relevant metrics are qualified and may produce
  exit `3`. Read both output warnings and stderr diagnostics.
- Do not infer project health, impact, priority, or next actions. Request the
  relevant approved evidence or user judgment if asked; do not invent it.

## Exit codes

| Code | Meaning | Required handling |
|---:|---|---|
| `0` | Complete usable result. | Still inspect JSON, freshness, validation, and warnings before reporting. |
| `1` | Local file/I/O or timezone-data failure. | Read the safe JSON stderr diagnostic; check local paths/permissions and `tzdata`. Report not performed if no result exists. |
| `2` | Invalid arguments, normalized data, status map, counting rule, timestamps, holidays, or evidence. | Read the safe JSON stderr diagnostic. Do not present a failed run as calculated output; correct only supplied input/configuration. |
| `3` | Usable but incomplete result. | Read the output, warnings, freshness, and per-issue data gaps; report unavailable measures explicitly. |

Duplicate issue keys, malformed JSON/date values, non-empty holiday exclusions
under this rule, future timestamps, inconsistent status mapping, invalid
thresholds, or output/input collisions are not silently accepted. Do not expose
raw sensitive Jira records in diagnostics or reports. Do not contact Jira or
Confluence, use credentials, or make network calls.
