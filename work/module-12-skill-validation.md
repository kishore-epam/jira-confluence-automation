# Module 12 Skills: Local End-to-End Validation

This report records local verification evidence only. It is not a claim of
Autocode acceptance, production approval, or production readiness.

## Scope and paths

- Workspace Git root: `C:\workspace\hello-genai`
- Project Git root: `C:\workspace\hello-genai\work\module03-task`
- Python environment: `C:\workspace\hello-genai\work\module03-task\.venv\Scripts\python.exe`
- Instructions:
  - `C:\workspace\hello-genai\instructions\use-load_jira_export.agent.md`
  - `C:\workspace\hello-genai\instructions\use-calculate_sprint_metrics.agent.md`
  - `C:\workspace\hello-genai\instructions\use-calculate_issue_aging.agent.md`
- Scripts:
  - `C:\workspace\hello-genai\work\module03-task\tools\load_jira_export.py`
  - `C:\workspace\hello-genai\work\module03-task\tools\calculate_sprint_metrics.py`
  - `C:\workspace\hello-genai\work\module03-task\tools\calculate_issue_aging.py`
- Shared contract and sanitized tests/fixtures:
  - `C:\workspace\hello-genai\work\module03-task\tools\jira_contract.py`
  - `C:\workspace\hello-genai\work\module03-task\test_load_jira_export.py`
  - `C:\workspace\hello-genai\work\module03-task\test_calculate_sprint_metrics.py`
  - `C:\workspace\hello-genai\work\module03-task\test_calculate_issue_aging.py`
  - `C:\workspace\hello-genai\work\module03-task\tests\fixtures\module12\`
  - `C:\workspace\hello-genai\work\module03-task\tests\fixtures\jira\`
- Validation outputs were confined to:
  - `C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\`
  - `C:\Users\KISHOR~1\AppData\Local\Temp\issue-aging-original-request-ija62hoc\`
  - `C:\Users\KISHOR~1\AppData\Local\Temp\module12-fatal-preservation-4dcpv65m\`

All input records used were sanitized local fixtures or temporary synthetic
records. No live services, credentials, network calls, publishing, or
automatic distribution were used.

## Checks and results

| Check | Expected | Observed | Result |
|---|---|---|---|
| All three scripts and `--help` | Scripts exist; help exits 0 and exposes documented options | All script paths existed. `load_jira_export.py --help`, `calculate_sprint_metrics.py --help`, and `calculate_issue_aging.py --help` each exited 0; documented CLI options were present. | **PASS** |
| Loader instruction leads to execution | Run its documented controlled-fixture command and inspect output | Loader exited 3 and emitted normalized JSON with `validation: Incomplete`, `freshness: Current`, and safe `history_unavailable` / `sprint_baseline_unavailable` diagnostics. This is the fixture's declared missing-evidence condition, not a failed invocation. | **PASS** |
| Calculator instructions lead to execution | Run actual documented loader-to-calculator workflows | The shared manifest loader exited 0. Sprint and aging calculators each ran against its normalized output and exited 0. | **PASS** |
| Loader output compatibility | Normalized contract feeds both calculators | Both calculators accepted the same loader-produced JSON. Sprint consumed the declared baseline/history evidence; aging consumed snapshot and transition provenance. | **PASS** |
| Static sprint results | Match `tests\fixtures\module12\sprint-expected-results.json` | Baseline committed/completed/remaining: `16/0/16`; current scope/completed/remaining: `18/2/16`; addition `USF-PLAN-4`; removal `USF-PLAN-3`. Matches the static expected values. | **PASS** |
| Aging threshold boundaries | Match `issue-aging-expected-results.json` | Exactly 5 business days produced breach `true`; exactly 10 calendar days produced long-in-progress `false`; 11 days produced `true`; Friday-to-Monday counted 1 business day. | **PASS** |
| Missing-data and defined test cases | Missing history remains unavailable; loader/sprint/aging focused cases pass | Aging missing-history output had `null`/Unavailable in-progress age and flag with `continuous_in_progress_history_required`. The focused suite also covers loader malformed/duplicate/missing/unmapped/stale/future/optional cases; sprint baseline/scope/estimate/reopen/missing-history/decimal/empty cases; and aging DST/reopened/future/holiday/history cases. | **PASS** |
| Freshness and provenance | Downstream output preserves upstream freshness and evidence | Complete smoke inputs had all three sources `Current`. Sprint output retained baseline/history source IDs, hashes, and history coverage; aging output retained issue source locator and transition source locator. | **PASS** |
| Input protection | Local inputs remain unchanged | SHA-256 comparisons before/after the boundary and fatal-failure runs found no changed checked-in fixture/configuration inputs. Tests also assert input bytes are unchanged. | **PASS** |
| Prior output on fatal failure | Fatal validation failure preserves prior successful output | Loader malformed-input exit 2, sprint invalid-baseline exit 2, and aging mismatched-as-of exit 2 each left the sentinel prior output unchanged. | **PASS** |
| Prior output on incomplete result | Clarify exit-3 behavior | An initial sprint probe used an as-of that yielded a usable incomplete result (exit 3); that result replaced the prior output. Exit 3 is documented as usable-but-incomplete, not fatal validation. Fatal exit-2 preservation passed. | **PARTIAL — see note below** |
| Catalog links | Every relative link in `instructions\main.agent.md` resolves | All 7 catalog links resolved. The Copilot entry point at `.github\copilot-instructions.md` still points to `./instructions/main.agent.md`; it was not changed. | **PASS** |
| No external activity / unrelated changes | Local-only verification; preserve unrelated work | Commands ran locally against fixture files. No network clients, credentials, publishing, or unrelated edits were introduced. Existing worktree changes were not reverted. | **PASS** |

### Executed commands

Focused test command, from the project root:

```powershell
.\.venv\Scripts\python.exe -B -m unittest test_load_jira_export test_calculate_sprint_metrics test_calculate_issue_aging test_jira_tools
```

Exit code **0**; **90 tests passed**.

Help commands, from the project root (each exit code **0**):

```powershell
.\.venv\Scripts\python.exe -B .\tools\load_jira_export.py --help
.\.venv\Scripts\python.exe -B .\tools\calculate_sprint_metrics.py --help
.\.venv\Scripts\python.exe -B .\tools\calculate_issue_aging.py --help
```

Loader instruction example, using the sanitized controlled-export fixture
(exit **3**, expected incomplete normalized output):

```powershell
.\.venv\Scripts\python.exe -B .\tools\load_jira_export.py `
  --input .\tests\fixtures\module12\valid.json `
  --schema .\tests\fixtures\module12\schema.json `
  --status-map .\tests\fixtures\module12\status-map.json `
  --exported-at 2026-10-22T09:00:00-04:00 `
  --as-of 2026-10-22T10:00:00-04:00 `
  --stale-after-hours 24 `
  --timezone America/New_York `
  --output C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\controlled-loader\normalized.json
```

The calculator instructions' shared manifest-loader example exited **0**:

```powershell
.\.venv\Scripts\python.exe -B .\tools\load_jira_export.py `
  --test-only --manifest .\tests\fixtures\jira\manifest.json `
  --rules .\tests\fixtures\jira\synthetic-rules.json `
  --as-of 2026-10-22T09:00:00-04:00 `
  --window-start 2026-10-15T09:00:00-04:00 `
  --window-end 2026-10-22T09:00:00-04:00 `
  --timezone America/New_York `
  --output C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\integrated\normalized.json
```

Using that normalized output, the sprint instruction's extraction of the
declared baseline snapshot and history object was followed by this calculator
invocation (exit **0**):

```powershell
.\.venv\Scripts\python.exe -B .\tools\calculate_sprint_metrics.py `
  --test-only `
  --input C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\integrated\normalized.json `
  --sprint-id SYNTHETIC-1 `
  --baseline C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\integrated\baseline.json `
  --scope-history C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\integrated\history.json `
  --rules .\tests\fixtures\jira\synthetic-rules.json `
  --as-of 2026-10-22T09:00:00-04:00 `
  --timezone America/New_York `
  --output C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\integrated\sprint.json
```

The aging instruction's calculation against the same normalized output exited
**0**:

```powershell
.\.venv\Scripts\python.exe -B .\tools\calculate_issue_aging.py `
  --test-only `
  --input C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\integrated\normalized.json `
  --as-of 2026-10-22T09:00:00-04:00 `
  --status-map .\tests\fixtures\module12\status-map.json `
  --business-day-rule .\tests\fixtures\module12\business-day-rule.json `
  --holidays .\tests\fixtures\module12\holidays-empty.json `
  --no-update-business-days 5 `
  --in-progress-calendar-days 10 `
  --timezone America/New_York `
  --output C:\Users\KISHOR~1\AppData\Local\Temp\module12-instruction-smoke-chrwdfsc\integrated\aging.json
```

Fatal-output-protection checks used prior-output sentinels. Loader malformed
input exited **2** (`invalid UTF-8 JSON`); sprint invalid baseline evidence
exited **2** (`baseline evidence does not match...`); aging as-of mismatch
exited **2** (`--as-of must match normalized input`). All three preserved the
sentinel bytes. An earlier sprint probe returned exit **3**, a usable incomplete
result, and replaced its output as designed.

## Instruction correction made

During the preceding fixed-as-of test, the temporary test setup first supplied
baseline issue timestamps later than the baseline snapshot observation, which
the loader correctly rejected. A retry reused an existing output path, and an
initial holiday check consequently lacked valid normalized input. The aging
instruction was corrected to require snapshot-local timestamp consistency,
fresh output paths on every run/retry, and valid normalized input before a
holiday-policy rejection check. The original threshold/missing-history
scenarios were then repeated successfully.

## Remaining assumptions and production-readiness gaps

- All rules, statuses, dates, and fixtures are synthetic `synthetic-v1` only.
  No production Jira schema, business-day/holiday policy, status mapping, or
  history-completeness policy has been approved by this validation.
- The loader instruction example intentionally returns exit 3 because its
  fixture has no history or declared sprint baseline. Downstream sprint
  calculations require the separate manifest fixture with complete baseline
  and history evidence.
- Exit 3 is a usable incomplete result and is written to the output path. The
  fatal-failure preservation guarantee was verified for exit 2. If “protect
  prior successful output on failure” is intended to include exit 3, that
  behavior requires an explicit contract decision and targeted implementation
  change; it was not changed during verification.
- No live Jira/Confluence integration, release packaging, publishing, or
  Autocode acceptance was tested.

## Git status and proposed commit files

At verification time, the workspace repository contained these three
untracked instruction files; the requested report is an additional proposed
file:

```text
instructions/use-load_jira_export.agent.md
instructions/use-calculate_sprint_metrics.agent.md
instructions/use-calculate_issue_aging.agent.md
work/module-12-skill-validation.md
```

The nested project repository already had the following Module 12-related
changes. They were present before this report and were not staged:

```text
JIRA_TOOLS.md
test_jira_tools.py
tools/calculate_issue_aging.py
tools/calculate_sprint_metrics.py
tools/jira_contract.py
tools/load_jira_export.py
test_calculate_issue_aging.py
test_calculate_sprint_metrics.py
test_load_jira_export.py
tests/fixtures/module12/business-day-rule.json
tests/fixtures/module12/duplicate-key.json
tests/fixtures/module12/empty.json
tests/fixtures/module12/future-timestamp.json
tests/fixtures/module12/holidays-empty.json
tests/fixtures/module12/holidays-listed.json
tests/fixtures/module12/issue-aging-expected-results.json
tests/fixtures/module12/malformed.json
tests/fixtures/module12/missing-field.json
tests/fixtures/module12/missing-optional.json
tests/fixtures/module12/schema.json
tests/fixtures/module12/sprint-expected-results.json
tests/fixtures/module12/status-map.json
tests/fixtures/module12/unmapped-status.json
tests/fixtures/module12/valid.json
```

This is the proposed Module 12 commit file list only; it excludes generated
temporary outputs, real exports, secrets, and unrelated files. Nothing was
staged or committed.
