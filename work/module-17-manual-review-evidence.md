# Module 17 Manual-Review Evidence Summary

## Context and history

This repository contains work spanning Modules 13–17, including the prior module reports, Module 17 specification, implementation, and tests. The generic commit subjects earlier in the repository history predate the corrected Module 17 baby-step workflow. They remain part of the actual history.

The original history has deliberately **not** been rewritten, amended, squashed, rebased, backdated, or removed. The incremental commits below are present after the earlier broad/generic commits in the current Git history. Their separate task-specific subjects and focused source/test changes provide evidence of the later baby-step workflow; they do not erase or conceal the earlier commits.

## Genuine incremental Module 17 commits

### `87613643ea57f5bdb8f3c5f170589b7c65e89343`

- **Exact message:** `feat(module17): enforce Jira status mappings`
- **Files changed:** [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** Jira issue status/category mapping validation (T-017).
- **Test evidence:** Added tests accept a configured status/category pair and reject a mismatched category or unknown status.

### `def41fba22eef25148a1b2e7bb071c6e2706e0ca`

- **Exact message:** `feat(module17): align Jira worklog CSV contract`
- **Files changed:** [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** Jira worklog CSV schema and row validation (T-018).
- **Test evidence:** Tests cover valid decimal and zero hours, malformed/negative hours, duplicate worklog IDs, invalid timestamps, and the required hours column.

### `50ca660a50cfee0fb5db9370b892d582dcfef57f`

- **Exact message:** `feat(module17): enforce upload freshness and coverage`
- **Files changed:** [backend/src/schema.sql](../backend/src/schema.sql), [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** Source freshness, reporting-window coverage, active-sprint coverage, retention deadline and cleanup behavior (T-019).
- **Test evidence:** Tests exercise exact freshness boundaries and configured thresholds, future-dated exports, both reporting-window boundaries, active-sprint coverage, daylight-saving period boundaries, and source-file cleanup.

### `b6262700c70108134ceb2671b3c8f42eced75306`

- **Exact message:** `feat(module17): align remaining Jira CSV contracts`
- **Files changed:** [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** Remaining Jira CSV alignment, including sprint-scope intervals, issue links, and milestones (T-017/T-018).
- **Test evidence:** Tests cover accepted sprint-scope intervals and re-addition; reject retired event-style fields, overlapping membership intervals, invalid timestamps/points and reversed intervals; and validate issue-link and milestone contracts, including duplicates and sharing flags.

### `ab7c2238615e9034aed9089b9f4e5198c05eda13`

- **Exact message:** `feat(module17): implement report metric calculations`
- **Files changed:** [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** Business-day age, continuous in-progress age, sprint progress, milestone health, and Git activity calculations (T-021).
- **Test evidence:** A deterministic focused test supplies explicit data and checks expected numeric results, statuses, and warnings for the metric helpers.

### `e3b258ca0bb2b8808c01660b6b32737cd356723b`

- **Exact message:** `feat(module17): implement report run lifecycle`
- **Files changed:** [backend/src/schema.sql](../backend/src/schema.sql), [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** Report-run claim, heartbeat/lease, completion, authorization, duplicate/expired transition handling (T-022).
- **Test evidence:** Focused lifecycle tests cover claim, heartbeat, successful completion, active duplicate claims, expired claims, invalid transitions, and worker-token validation. Lifecycle database behavior in these unit tests uses a fake database adapter; these tests are not evidence of concurrency against a live PostgreSQL instance.

### `06e0d9ec659620472539e9c966711814ee925f9e`

- **Exact message:** `feat(module17): generate six-slide PowerPoint report`
- **Files changed:** [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** Deterministic report composition and six-slide PowerPoint generation (T-023).
- **Test evidence:** The deck test checks six ordered sections, report values in generated slides, and byte/hash equality for repeat generation. The later determinism fix strengthened the cross-time condition.

### `30ed253aa32b0c95a521ba69ee655e095f06b989`

- **Exact message:** `feat(module17): implement artifact promotion and retention`
- **Files changed:** [backend/src/schema.sql](../backend/src/schema.sql), [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** Dated artifact promotion, latest pointer/copy behavior, and retention cleanup (T-024).
- **Test evidence:** Tests exercise successful dated-artifact promotion/latest-pointer updates and expiration cleanup, including clearing the latest pointer.

### `6cc818c38090970fad19e874f4058bf2d96ad6c0`

- **Exact message:** `feat(module17): add scheduled worker startup`
- **Files changed:** [README.md](../README.md), [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js), [scripts/register-local-worker-task.ps1](../scripts/register-local-worker-task.ps1), [scripts/run-local-report-worker.ps1](../scripts/run-local-report-worker.ps1)
- **SpecKit capability:** Initial Windows Task Scheduler registration and scheduled-worker wrapper/startup work (T-025).
- **Test/verification evidence:** Tests cover Monday 09:00 Eastern scheduling, skipped missed runs, and the scheduled-trigger period anchor. The wrapper was designed to fail safely when its expected runnable worker is unavailable. This commit did **not** provide the runnable report worker.

### `120e16f9a45d1739eb9fa2b49f3b851f73130c87`

- **Exact message:** `feat(module17): verify complete and partial end-to-end workflows`
- **Files changed:** [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** T-028 test evidence for complete/partial report-content and failed-run preservation scenarios.
- **Test evidence and boundary:** The test builds a report snapshot, invokes the real slide builder and PowerPoint generator, checks six sections and stale-source warning text, then invokes failed completion and checks that a prior artifact remains. Its database adapter is a fake; it is not a full live-database/API/worker end-to-end execution and does not prove that the absent runnable worker exists.

### `9d3b62ed963b922af17920b76bc502b78eef3208`

- **Exact message:** `fix(module17): normalize PowerPoint package metadata`
- **Files changed:** [backend/src/server.js](../backend/src/server.js), [backend/test/server.test.js](../backend/test/server.test.js)
- **SpecKit capability:** T-023 deterministic PowerPoint packaging defect fix.
- **Test evidence:** The generator normalizes ZIP member timestamps and entry handling after producing the deck. The strengthened test deliberately waits longer than ZIP timestamp granularity, then compares bytes and SHA256 hashes and verifies six slides, required order, and report content.

### `9aed5b8799d5e91cba284bcc52c460ef7c4509a8`

- **Exact message:** `feat(module17): add local startup and schedule safeguards`
- **Files changed:** [README.md](../README.md), [backend/test/server.test.js](../backend/test/server.test.js), [scripts/register-local-startup-task.ps1](../scripts/register-local-startup-task.ps1), [scripts/register-local-worker-task.ps1](../scripts/register-local-worker-task.ps1), [scripts/run-local-report-worker.ps1](../scripts/run-local-report-worker.ps1), [scripts/start-local-services-on-logon.ps1](../scripts/start-local-services-on-logon.ps1)
- **SpecKit capability:** Local logon startup, interactive signed-in-session scheduling, Monday 09:00 America/New_York semantics, missed-trigger safeguards, and reporting-period anchor/prerequisite handling (T-025).
- **Test/verification evidence:** Added tests cover interactive startup/task definitions, missed occurrences, DST dates, and trigger anchoring. PowerShell syntax checks and task-registration `-WhatIf` checks passed without registering or altering scheduled tasks. The wrapper still safely reports the missing runnable worker; this increment does not complete worker integration.

## Fresh regression evidence

After inspecting the commit-level changes and focused tests, the complete backend regression suite was run with `npm test` from `backend/`: **43 passed, 0 failed**. This is a current regression result, not a claim that every SpecKit task is complete.

## Manual-review boundary

The commits above are distinct, genuine Module 17 increments with task-specific subjects and corresponding implementation/test changes. The historical generic messages and earlier broad commit remain visible precisely because Git history was preserved rather than rewritten.

This summary does not claim that all Module 17 requirements are complete. In particular, the scheduled wrapper still lacks the runnable report worker; full worker integration and a live-stack end-to-end verification remain outside the evidence listed here.
