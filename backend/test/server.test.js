'use strict';

const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const nodeFs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseCsv,
  reportingPeriodEnd,
  reportingPeriodBounds,
  sourceRetentionDeadline,
  validateSourceFreshnessAndCoverage,
  findCurrentActiveSprintStart,
  purgeExpiredSourceFiles,
  discardUploadData,
  validateCsvRows,
  validateUpdate,
  calculateBusinessDayAge,
  calculateInProgressAge,
  calculateSprintProgress,
  calculateMilestoneHealth,
  calculateGitActivity,
  buildReportDeckSlides,
  generatePowerPointReport,
  requireWorkerToken,
  claimReportRun,
  heartbeatReportRun,
  completeReportRun,
  promoteReportArtifact,
  purgeExpiredReportArtifacts,
} = require('../src/server');

test('reporting period stays open through the Monday 8:30 a.m. Eastern PM deadline', () => {
  assert.equal(reportingPeriodEnd(new Date('2026-10-26T12:29:00Z')), '2026-10-26');
  assert.equal(reportingPeriodEnd(new Date('2026-10-26T13:00:00Z')), '2026-11-02');
  assert.equal(reportingPeriodEnd(new Date('2026-10-27T12:00:00Z')), '2026-11-02');
});

test('reporting period boundary uses local Monday across the daylight-saving transition', () => {
  assert.equal(reportingPeriodEnd(new Date('2026-11-02T13:59:00Z')), '2026-11-02');
  assert.equal(reportingPeriodEnd(new Date('2026-11-02T14:00:00Z')), '2026-11-09');
});

test('reporting period UTC boundaries preserve seven local calendar days across DST', () => {
  const springPeriod = reportingPeriodBounds('2026-03-09');
  const fallPeriod = reportingPeriodBounds('2026-11-02');
  assert.equal(springPeriod.periodStart.toISOString(), '2026-03-02T14:00:00.000Z');
  assert.equal(springPeriod.periodEnd.toISOString(), '2026-03-09T13:00:00.000Z');
  assert.equal((springPeriod.periodEnd - springPeriod.periodStart) / 3600000, 167);
  assert.equal(fallPeriod.periodStart.toISOString(), '2026-10-26T13:00:00.000Z');
  assert.equal(fallPeriod.periodEnd.toISOString(), '2026-11-02T14:00:00.000Z');
  assert.equal((fallPeriod.periodEnd - fallPeriod.periodStart) / 3600000, 169);
});

function sourceMetadata(overrides = {}) {
  return {
    exportedAtUtc: '2026-10-26T13:00:00Z',
    coverageStartUtc: '2026-10-26T13:00:00Z',
    coverageEndUtc: '2026-11-02T14:00:00Z',
    periodEndLocalDate: '2026-11-02',
    freshnessDays: 7,
    sourceType: 'jira',
    dataset: 'issues',
    ...overrides,
  };
}

test('source freshness accepts the exact configured calendar-day boundary and rejects older data', () => {
  assert.equal(validateSourceFreshnessAndCoverage(sourceMetadata()).status, 'accepted');
  const stale = validateSourceFreshnessAndCoverage(sourceMetadata({
    exportedAtUtc: '2026-10-26T12:59:59.999Z',
  }));
  assert.equal(stale.status, 'stale');
  assert.match(stale.summary, /7-calendar-day freshness limit/);
});

test('source freshness honors a configured threshold other than seven days', () => {
  const stale = validateSourceFreshnessAndCoverage(sourceMetadata({
    exportedAtUtc: '2026-10-29T12:59:59.999Z',
    freshnessDays: 3,
  }));
  assert.equal(stale.status, 'stale');
  assert.match(stale.summary, /3-calendar-day freshness limit/);
});

test('source extraction at the scheduled trigger is accepted but a later extraction is incomplete', () => {
  assert.equal(validateSourceFreshnessAndCoverage(sourceMetadata({
    exportedAtUtc: '2026-11-02T14:00:00Z',
  })).status, 'accepted');
  const future = validateSourceFreshnessAndCoverage(sourceMetadata({
    exportedAtUtc: '2026-11-02T14:00:00.001Z',
  }));
  assert.equal(future.status, 'incomplete');
  assert.match(future.summary, /later than the scheduled reporting trigger/);
});

test('source coverage must include both reporting interval boundaries', () => {
  assert.equal(validateSourceFreshnessAndCoverage(sourceMetadata()).status, 'accepted');
  for (const override of [
    { coverageStartUtc: '2026-10-26T13:00:00.001Z' },
    { coverageEndUtc: '2026-11-02T13:59:59.999Z' },
  ]) {
    assert.equal(validateSourceFreshnessAndCoverage(sourceMetadata(override)).status, 'incomplete');
  }
});

test('Jira sprint-scope coverage must include active sprint start and reporting-period end', () => {
  const activeSprintStartAtUtc = '2026-10-01T12:00:00Z';
  const goodCoverage = sourceMetadata({
    dataset: 'sprint-scope',
    activeSprintStartAtUtc,
    coverageStartUtc: activeSprintStartAtUtc,
  });
  assert.equal(validateSourceFreshnessAndCoverage(goodCoverage).status, 'accepted');
  assert.equal(validateSourceFreshnessAndCoverage({
    ...goodCoverage,
    coverageStartUtc: '2026-10-01T12:00:00.001Z',
  }).status, 'incomplete');
  const missingSprint = validateSourceFreshnessAndCoverage(sourceMetadata({
    dataset: 'sprint-scope',
  }));
  assert.equal(missingSprint.status, 'incomplete');
  assert.match(missingSprint.summary, /sprint data is unavailable/);
});

test('active sprint start is derived only from a current accepted Jira sprint export', async () => {
  const inputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'usf-plan-sprints-'));
  await fs.writeFile(
    path.join(inputDirectory, 'sprints.csv'),
    'sprint_id,name,state,start_at_utc,end_at_utc\n1,Sprint 1,active,2026-10-01T12:00:00Z,2026-11-05T12:00:00Z\n',
  );
  const db = {
    async query() {
      return {
        rows: [{
          storage_key: 'sprints.csv',
          validation_status: 'accepted',
          exported_at: '2026-10-26T13:00:00Z',
          coverage_start: '2026-10-26T13:00:00Z',
          coverage_end: '2026-11-02T14:00:00Z',
        }],
      };
    },
  };
  try {
    assert.equal(
      await findCurrentActiveSprintStart('2026-11-02', 7, db, inputDirectory),
      '2026-10-01T12:00:00Z',
    );
    db.query = async () => ({
      rows: [{
        storage_key: 'sprints.csv',
        validation_status: 'stale',
        exported_at: '2026-10-26T12:59:59Z',
        coverage_start: '2026-10-26T13:00:00Z',
        coverage_end: '2026-11-02T14:00:00Z',
      }],
    });
    assert.equal(await findCurrentActiveSprintStart('2026-11-02', 7, db, inputDirectory), null);
  } finally {
    await fs.rm(inputDirectory, { recursive: true, force: true });
  }
});

test('accepted source retention expires before the seven-calendar-day maximum', () => {
  const receivedAt = new Date('2026-01-01T00:00:00Z');
  const deadline = sourceRetentionDeadline(receivedAt);
  assert.equal(deadline.toISOString(), '2026-01-07T23:59:00.000Z');
  assert.ok(deadline <= new Date(receivedAt.getTime() + 7 * 24 * 60 * 60 * 1000));
});

test('expired source cleanup deletes the file but preserves its provenance record', async () => {
  const inputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'usf-plan-retention-'));
  const filePath = path.join(inputDirectory, 'expired.csv');
  await fs.writeFile(filePath, 'issue_key\nUSF-1\n');
  let retainedStorageKey = 'expired.csv';
  const db = {
    async query(sql) {
      if (sql.includes('SELECT source_input_id, storage_key')) {
        return { rows: [{ source_input_id: 'source-1', storage_key: retainedStorageKey }], rowCount: 1 };
      }
      assert.match(sql, /UPDATE source_inputs SET storage_key = NULL/);
      assert.match(sql, /WHERE source_input_id = \$1 AND retention_until <= \$2/);
      retainedStorageKey = null;
      return { rows: [], rowCount: 1 };
    },
  };
  try {
    assert.equal(await purgeExpiredSourceFiles(db, inputDirectory, new Date('2026-01-08T00:00:00Z')), 1);
    assert.equal(retainedStorageKey, null);
    await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
  } finally {
    await fs.rm(inputDirectory, { recursive: true, force: true });
  }
});

test('capacity upload buffers and person-level rows are discarded after processing', () => {
  const file = { buffer: Buffer.from('person_key,week_start,planned_hours') };
  const parsed = { records: [{ person_key: 'person-a', week_start: '2026-10-26', planned_hours: '4' }] };
  discardUploadData('capacity', file, parsed);
  assert.ok(file.buffer.every((byte) => byte === 0));
  assert.deepEqual(parsed.records, []);
});

test('weekly update validation requires all narrative fields and valid RAG status', () => {
  assert.deepEqual(validateUpdate({
    ragStatus: 'red',
    ragRationale: 'Delivery risk is increasing.',
    accomplishments: [],
    risksAndBlockers: ['Dependency is delayed.'],
    decisionsNeeded: [],
    nextWeekPriorities: ['Resolve dependency.'],
    milestoneChanges: [],
  }), []);

  const errors = validateUpdate({ ragStatus: 'purple', ragRationale: '', accomplishments: [] });
  assert.ok(errors.some((error) => error.field === 'ragStatus'));
  assert.ok(errors.some((error) => error.field === 'ragRationale'));
  assert.ok(errors.some((error) => error.field === 'risksAndBlockers'));
});

test('CSV parser supports quoted delimiters and rejects malformed UTF-8', () => {
  const parsed = parseCsv(Buffer.from('issue_key,title\r\nUSF-1,"A, quoted title"\r\n', 'utf8'));
  assert.deepEqual(parsed.headers, ['issue_key', 'title']);
  assert.equal(parsed.records[0].title, 'A, quoted title');
  assert.throws(() => parseCsv(Buffer.from([0xc3, 0x28])), /CSV must be valid UTF-8|encoded data/i);
});

test('Jira sprint CSV must have exactly one active sprint', () => {
  const headers = ['sprint_id', 'name', 'state', 'start_at_utc', 'end_at_utc'];
  assert.equal(validateCsvRows('jira', 'sprints', headers, [
    { sprint_id: '1', name: 'Sprint 1', state: 'active', start_at_utc: '2026-10-01T00:00:00Z', end_at_utc: '2026-10-14T00:00:00Z' },
  ]), null);
  assert.match(validateCsvRows('jira', 'sprints', headers, []), /at least one data row/i);
});

const jiraIssueHeaders = [
  'issue_key',
  'title',
  'status',
  'status_category',
  'updated_at_utc',
  'in_progress_since_utc',
  'story_points',
  'issue_type',
  'client_shareable',
];

const jiraStatusMapping = {
  'To Do': 'todo',
  'In Progress': 'in_progress',
  Done: 'done',
};

function jiraIssue(status, statusCategory) {
  return {
    issue_key: 'USF-1',
    title: 'Example issue',
    status,
    status_category: statusCategory,
    updated_at_utc: '2026-10-26T12:00:00Z',
    in_progress_since_utc: '',
    story_points: '3',
    issue_type: 'Story',
    client_shareable: 'true',
  };
}

test('Jira issue accepts a status/category pair that matches the configured mapping', () => {
  assert.equal(validateCsvRows(
    'jira',
    'issues',
    jiraIssueHeaders,
    [jiraIssue('In Progress', 'in_progress')],
    jiraStatusMapping,
  ), null);
});

test('Jira issue rejects a known status with a mismatched category', () => {
  assert.match(validateCsvRows(
    'jira',
    'issues',
    jiraIssueHeaders,
    [jiraIssue('In Progress', 'done')],
    jiraStatusMapping,
  ), /mismatched status\/category mapping/i);
});

test('Jira issue rejects a status that is not configured in the mapping', () => {
  assert.match(validateCsvRows(
    'jira',
    'issues',
    jiraIssueHeaders,
    [jiraIssue('Blocked', 'in_progress')],
    jiraStatusMapping,
  ), /unknown or mismatched status\/category mapping/i);
});

const jiraWorklogHeaders = ['worklog_id', 'issue_key', 'started_at_utc', 'hours'];

function jiraWorklog(worklogId, hours, startedAt = '2026-10-26T12:00:00Z') {
  return {
    worklog_id: worklogId,
    issue_key: 'USF-1',
    started_at_utc: startedAt,
    hours,
  };
}

test('Jira worklog contract accepts a valid non-negative decimal hours value', () => {
  assert.equal(validateCsvRows(
    'jira',
    'worklogs',
    jiraWorklogHeaders,
    [jiraWorklog('1', '1.25')],
  ), null);
});

test('Jira worklog contract accepts zero hours', () => {
  assert.equal(validateCsvRows(
    'jira',
    'worklogs',
    jiraWorklogHeaders,
    [jiraWorklog('1', '0')],
  ), null);
});

test('Jira worklog contract rejects negative and malformed hours values', () => {
  for (const hours of ['-0.25', 'not-a-number']) {
    assert.match(validateCsvRows(
      'jira',
      'worklogs',
      jiraWorklogHeaders,
      [jiraWorklog('1', hours)],
    ), /invalid hours\/timestamps/i);
  }
});

test('Jira worklog contract rejects duplicate worklog IDs', () => {
  assert.match(validateCsvRows(
    'jira',
    'worklogs',
    jiraWorklogHeaders,
    [jiraWorklog('1', '1'), jiraWorklog('1', '2')],
  ), /duplicate IDs/i);
});

test('Jira worklog contract requires a valid UTC start timestamp', () => {
  for (const startedAt of ['', '2026-10-26T12:00:00+02:00', 'not-a-timestamp']) {
    assert.match(validateCsvRows(
      'jira',
      'worklogs',
      jiraWorklogHeaders,
      [jiraWorklog('1', '1', startedAt)],
    ), /invalid hours\/timestamps/i);
  }
});

test('Jira worklog contract requires the specified hours column', () => {
  assert.match(validateCsvRows(
    'jira',
    'worklogs',
    ['worklog_id', 'issue_key', 'started_at_utc', 'time_spent_seconds'],
    [jiraWorklog('1', '1')],
  ), /columns do not match/i);
});

const scopeHeaders = ['sprint_id', 'issue_key', 'added_at_utc', 'removed_at_utc', 'story_points_at_sprint_start', 'story_points_current', 'completed_at_utc'];

function scopeRow(overrides = {}) {
  return {
    sprint_id: '1',
    issue_key: 'USF-1',
    added_at_utc: '2026-10-01T12:00:00Z',
    removed_at_utc: '',
    story_points_at_sprint_start: '3',
    story_points_current: '5',
    completed_at_utc: '',
    ...overrides,
  };
}

const scopeValidate = (rows, headers = scopeHeaders) => validateCsvRows('jira', 'sprint-scope', headers, rows);

test('Jira sprint-scope accepts the specified interval contract, including added-after-start and re-addition', () => {
  assert.equal(scopeValidate([scopeRow()]), null);
  assert.equal(scopeValidate([scopeRow({ story_points_at_sprint_start: '' })]), null);
  assert.equal(scopeValidate([
    scopeRow({ removed_at_utc: '2026-10-05T12:00:00Z' }),
    scopeRow({ added_at_utc: '2026-10-05T12:00:00Z' }),
  ]), null);
  assert.equal(scopeValidate([]), null);
});

test('metric helpers compute business-day age, in-progress age, sprint progress, milestone health, and git activity', () => {
  assert.equal(calculateBusinessDayAge('2026-10-21', '2026-10-27'), 4);
  assert.equal(calculateInProgressAge('2026-10-15T12:00:00Z', '2026-10-26T12:00:00Z'), 11);
  assert.deepEqual(calculateSprintProgress([
    {
      issue_key: 'USF-1',
      added_at_utc: '2026-10-01T12:00:00Z',
      removed_at_utc: '',
      story_points_at_sprint_start: '3',
      story_points_current: '5',
      completed_at_utc: '2026-10-20T12:00:00Z',
    },
    {
      issue_key: 'USF-2',
      added_at_utc: '2026-10-20T12:00:00Z',
      removed_at_utc: '',
      story_points_at_sprint_start: '2',
      story_points_current: '2',
      completed_at_utc: '',
    },
  ], '2026-10-01T12:00:00Z', '2026-10-26T12:00:00Z'), {
    committedPoints: 3,
    completedPoints: 5,
    remainingPoints: 2,
    status: 'available',
    warnings: [],
  });
  assert.deepEqual(calculateMilestoneHealth([
    { milestone_key: 'M-1', due_date: '2026-10-20', status: 'Done' },
    { milestone_key: 'M-2', due_date: '2026-10-30', status: 'In Progress' },
  ], '2026-10-26', { 'Done': 'done', 'In Progress': 'in_progress' }), [
    { milestoneKey: 'M-1', status: 'complete', reason: 'Status is mapped as done.' },
    { milestoneKey: 'M-2', status: 'on_track', reason: 'Milestone remains active.' },
  ]);
  assert.deepEqual(calculateGitActivity([
    { repository: 'repo-a', commit_sha: 'abc123', committed_at_utc: '2026-10-26T10:00:00Z' },
    { repository: 'repo-b', commit_sha: 'def456', committed_at_utc: '2026-10-26T10:00:00Z' },
    { repository: 'repo-a', commit_sha: 'abc123', committed_at_utc: '2026-10-26T10:00:00Z' },
    { repository: 'repo-a', commit_sha: 'ghi789', committed_at_utc: '2026-10-24T10:00:00Z' },
  ], ['repo-a'], '2026-10-26T09:00:00Z', '2026-10-26T13:00:00Z'), { count: 1, status: 'available', warnings: [] });
});

test('Jira sprint-scope rejects the retired event-style columns', () => {
  assert.match(scopeValidate([], ['sprint_id', 'issue_key', 'event_type', 'event_at_utc', 'story_points_at_event']), /columns do not match/i);
});

test('Jira sprint-scope rejects overlapping membership intervals for the same issue and sprint', () => {
  assert.match(scopeValidate([
    scopeRow({ removed_at_utc: '2026-10-10T12:00:00Z' }),
    scopeRow({ added_at_utc: '2026-10-05T12:00:00Z' }),
  ]), /overlapping/i);
  assert.match(scopeValidate([scopeRow(), scopeRow({ added_at_utc: '2026-10-05T12:00:00Z' })]), /overlapping/i);
  assert.equal(scopeValidate([scopeRow(), scopeRow({ sprint_id: '2' })]), null);
});

test('Jira sprint-scope rejects missing added time, bad timestamps, negative points, and removal before addition', () => {
  for (const override of [
    { added_at_utc: '' },
    { completed_at_utc: 'yesterday' },
    { removed_at_utc: '2026-09-30T12:00:00Z' },
    { story_points_current: '-1' },
    { story_points_at_sprint_start: 'abc' },
  ]) {
    assert.match(scopeValidate([scopeRow(override)]), /invalid identifiers, estimates, or timestamps/i);
  }
});

const linkHeaders = ['issue_key', 'linked_issue_key', 'link_type'];

test('Jira issue-links follow the specified columns and require every value', () => {
  assert.equal(validateCsvRows('jira', 'issue-links', linkHeaders, [
    { issue_key: 'USF-1', linked_issue_key: 'USF-2', link_type: 'blocks' },
  ]), null);
  assert.match(validateCsvRows('jira', 'issue-links', linkHeaders, [
    { issue_key: 'USF-1', linked_issue_key: '', link_type: 'blocks' },
  ]), /must include issue keys and a link type/i);
  assert.match(validateCsvRows('jira', 'issue-links', ['link_id', 'source_issue_key', 'target_issue_key', 'link_type'], [
    { link_id: '1', source_issue_key: 'USF-1', target_issue_key: 'USF-2', link_type: 'blocks' },
  ]), /columns do not match/i);
});

test('worker token gate rejects missing or invalid bearer tokens', () => {
  process.env.USF_PLAN_WORKER_TOKEN = 'secret-token';
  const next = () => {};
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  requireWorkerToken({ headers: {} }, res, next);
  assert.equal(res.statusCode, 401);
  requireWorkerToken({ headers: { authorization: 'Bearer wrong' } }, res, next);
  assert.equal(res.statusCode, 401);

  const okRes = { statusCode: null, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
  requireWorkerToken({ headers: { authorization: 'Bearer secret-token' } }, okRes, next);
  assert.equal(okRes.statusCode, null);
});

test('report-run lifecycle claims, heartbeats, and completes a running job', async () => {
  const fakeDb = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.includes('SELECT project_id FROM projects')) {
        return { rowCount: 1, rows: [{ project_id: 11 }] };
      }
      if (normalized.includes('SELECT report_run_id FROM report_runs WHERE project_id = $1 AND status = \'running\'')) {
        return { rowCount: 0, rows: [] };
      }
      if (normalized.includes('SELECT settings_version_id FROM reporting_settings')) {
        return { rowCount: 1, rows: [{ settings_version_id: 3 }] };
      }
      if (normalized.includes('SELECT project_update_id FROM project_updates')) {
        return { rowCount: 1, rows: [{ project_update_id: 9 }] };
      }
      if (normalized.includes('INSERT INTO report_runs')) {
        return {
          rowCount: 1,
          rows: [{
            report_run_id: params[0],
            project_id: params[1],
            period_start: params[2],
            period_end: params[3],
            status: 'running',
            scheduled_at: params[4],
            started_at: params[5],
            lease_expires_at: params[6],
            last_heartbeat_at: params[7],
            project_update_id: params[8],
            settings_version_id: params[9],
            trigger_type: params[10],
            retry_of_report_run_id: params[11],
            worker_version: params[12],
          }],
        };
      }
      if (normalized.includes('UPDATE report_runs SET last_heartbeat_at = $2, lease_expires_at = $3')) {
        return {
          rowCount: 1,
          rows: [{
            report_run_id: params[0],
            status: 'running',
            last_heartbeat_at: params[1],
            lease_expires_at: params[2],
          }],
        };
      }
      if (normalized.includes('UPDATE report_runs SET status = $2')) {
        return {
          rowCount: 1,
          rows: [{
            report_run_id: params[0],
            status: params[1],
            completed_at: params[2],
            failure_summary: params[4],
            artifact_path: params[5],
          }],
        };
      }
      if (normalized.includes('SELECT report_run_id, status, lease_expires_at')) {
        return {
          rowCount: 1,
          rows: [{
            report_run_id: params[0],
            status: 'running',
            lease_expires_at: '2026-11-02T14:05:00.000Z',
            artifact_path: null,
            completed_at: null,
          }],
        };
      }
      if (normalized.includes('SELECT project_id, period_end FROM report_runs WHERE report_run_id = $1')) {
        return {
          rowCount: 1,
          rows: [{ project_id: 11, period_end: '2026-11-02T14:00:00.000Z' }],
        };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const run = await claimReportRun({
    db: fakeDb,
    periodEndLocalDate: '2026-11-02',
    sourceInputIds: ['source-1', 'source-2'],
  });
  assert.equal(run.status, 'running');
  assert.equal(run.projectId, 11);

  const heartbeat = await heartbeatReportRun({ db: fakeDb, runId: run.reportRunId, now: new Date('2026-11-02T14:00:00Z') });
  assert.equal(heartbeat.status, 'running');

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'usf-plan-lifecycle-'));
  const stagedPath = path.join(tempDir, '2026-11-02-report.pptx');
  await fs.writeFile(stagedPath, 'report-bytes');

  const complete = await completeReportRun({
    db: fakeDb,
    runId: run.reportRunId,
    finalStatus: 'succeeded',
    artifactPath: stagedPath,
    now: new Date('2026-11-02T14:01:00Z'),
    reportDirectory: tempDir,
  });
  assert.equal(complete.status, 'succeeded');
  assert.match(complete.artifactPath, /USF-PLAN-weekly-status-2026-11-02\.pptx/);
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('report-run lifecycle rejects duplicate claims and expired or invalid transitions', async () => {
  const activeDb = {
    async query(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.includes('SELECT project_id FROM projects')) {
        return { rowCount: 1, rows: [{ project_id: 11 }] };
      }
      if (normalized.includes('SELECT report_run_id FROM report_runs WHERE project_id = $1 AND status = \'running\'')) {
        return { rowCount: 1, rows: [{ report_run_id: 'run-123' }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
  await assert.rejects(() => claimReportRun({ db: activeDb, periodEndLocalDate: '2026-11-02' }), /Another active report run/i);

  const expiredDb = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.includes('SELECT report_run_id, status, lease_expires_at')) {
        return {
          rowCount: 1,
          rows: [{ report_run_id: params[0], status: 'running', lease_expires_at: '2026-11-02T15:00:00.000Z' }],
        };
      }
      if (normalized.includes('SELECT project_id, period_end FROM report_runs WHERE report_run_id = $1')) {
        return {
          rowCount: 1,
          rows: [{ project_id: 11, period_end: '2026-11-02T14:00:00.000Z' }],
        };
      }
      if (normalized.includes('UPDATE report_runs SET last_heartbeat_at = $2, lease_expires_at = $3')) {
        return { rowCount: 1, rows: [{ report_run_id: params[0], status: 'running', lease_expires_at: params[2], last_heartbeat_at: params[1] }] };
      }
      if (normalized.includes('UPDATE report_runs SET status = $2')) {
        return { rowCount: 1, rows: [{ report_run_id: params[0], status: params[1], completed_at: params[2], failure_summary: params[4], artifact_path: params[5] }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
  await assert.rejects(() => heartbeatReportRun({ db: expiredDb, runId: 'run-1', now: new Date('2026-11-02T16:00:00Z') }), /expired/i);
  await assert.rejects(() => completeReportRun({ db: expiredDb, runId: 'run-1', finalStatus: 'partial', now: new Date('2026-11-02T16:00:00Z') }), /expired/i);
  await assert.rejects(() => completeReportRun({ db: expiredDb, runId: 'run-1', finalStatus: 'invalid', now: new Date('2026-11-02T14:00:00Z') }), /only complete as/i);
});

const milestoneHeaders = ['milestone_key', 'name', 'due_date', 'status', 'updated_at_utc', 'client_shareable'];

function milestone(overrides = {}) {
  return {
    milestone_key: 'M-1',
    name: 'Beta',
    due_date: '2026-11-15',
    status: 'In Progress',
    updated_at_utc: '2026-10-26T12:00:00Z',
    client_shareable: 'true',
    ...overrides,
  };
}

test('Jira milestones accept the specified contract', () => {
  assert.equal(validateCsvRows('jira', 'milestones', milestoneHeaders, [milestone()]), null);
});

test('Jira milestones reject duplicate keys, bad dates, bad timestamps, bad sharing flags, and missing status', () => {
  assert.match(validateCsvRows('jira', 'milestones', milestoneHeaders, [milestone(), milestone()]), /duplicate keys/i);
  for (const override of [
    { due_date: '2026-02-30' },
    { updated_at_utc: '2026-10-26T12:00:00+02:00' },
    { client_shareable: 'yes' },
    { status: '' },
  ]) {
    assert.match(validateCsvRows('jira', 'milestones', milestoneHeaders, [milestone(override)]), /missing status or invalid/i);
  }
  assert.match(validateCsvRows('jira', 'milestones', ['milestone_id', 'name', 'status', 'due_date_local', 'client_shareable'], [
    { milestone_id: '1', name: 'Beta', status: 'Done', due_date_local: '2026-11-15', client_shareable: 'true' },
  ]), /columns do not match/i);
});

test('six-slide report deck is deterministic and uses the required ordered sections', async () => {
  const snapshot = {
    projectKey: 'USF-PLAN',
    periodStartLocalDate: '2026-10-26',
    periodEndLocalDate: '2026-11-02',
    ragStatus: 'amber',
    ragRationale: 'Team momentum is solid, but source freshness and dependency closure need attention.',
    accomplishments: ['Completed sprint planning and issue cleanup.'],
    topAttentionItems: ['Resolve dependency on Jira sprint-scope coverage.', 'Refresh stale Confluence references.'],
    sprint: {
      name: 'Sprint 13',
      committedPoints: 31,
      completedPoints: 19,
      remainingPoints: 12,
      additions: ['USF-14 +3'],
      removals: ['USF-8 -2'],
      caveats: ['Estimate history for one issue is partial.'],
    },
    milestones: [
      { milestoneKey: 'M-1', status: 'on_track', summary: 'Release candidate is on track.' },
    ],
    issues: [
      { issueKey: 'USF-21', status: 'in_progress', age: '7 business days', summary: 'Needs dependency confirmation.' },
    ],
    blockers: [{ issueKey: 'USF-21', status: 'blocked', summary: 'Waiting on API contract sign-off.' }],
    decisions: [{ issueKey: 'Decision', status: 'open', summary: 'Need sponsor review for scope change.' }],
    capacity: { plannedHours: 32.5, actualHours: 28.0 },
    gitActivity: { count: 14 },
    sourceWarnings: ['Jira sprint-scope coverage is partial.'],
    confluenceRefs: [{ title: 'Project scope', summary: 'Approved summary for the current sprint.' }],
    nextWeekPriorities: ['Complete dependency sign-off.', 'Refresh stale export set.'],
  };

  const slides = buildReportDeckSlides(snapshot);
  assert.equal(slides.length, 6);
  assert.deepEqual(slides.map((slide) => slide.title), [
    'Executive summary',
    'Sprint progress and scope',
    'Milestones and forecast availability',
    'Issues, blockers, dependencies, and decisions',
    'Aggregate capacity and Git activity',
    'Next-week priorities and data quality',
  ]);
  assert.match(slides[0].body.join(' '), /RAG status: amber/i);
  assert.match(slides[5].body.join(' '), /Next-week priorities/i);

  const tmpDir = path.join(os.tmpdir(), `usf-plan-pptx-${randomUUID()}`);
  const firstPath = path.join(tmpDir, 'report-a.pptx');
  const secondPath = path.join(tmpDir, 'report-b.pptx');
  const firstReport = generatePowerPointReport(snapshot, firstPath);
  const secondReport = generatePowerPointReport(snapshot, secondPath);
  assert.equal(firstReport, firstPath);
  assert.equal(secondReport, secondPath);
  assert.equal(nodeFs.readFileSync(firstPath).equals(nodeFs.readFileSync(secondPath)), true);

  const python = process.platform === 'win32' ? 'py' : 'python3';
  const slideCount = spawnSync(python, ['-c', `from pptx import Presentation; prs = Presentation(r'${firstPath}'); print(len(prs.slides))`], { encoding: 'utf8' });
  assert.equal(Number(slideCount.stdout.trim()), 6);
  assert.match(slideCount.stdout, /6/);
  assert.equal(nodeFs.existsSync(firstPath), true);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('successful report completion promotes the dated artifact and updates the latest pointer', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'usf-plan-artifact-'));
  const stagedPath = path.join(tempDir, 'staged-run-1.pptx');
  await fs.writeFile(stagedPath, 'binary-report');

  const fakeDb = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.includes('SELECT report_run_id, status, lease_expires_at, artifact_path, completed_at, started_at')) {
        return {
          rowCount: 1,
          rows: [{
            report_run_id: 'run-1',
            status: 'running',
            lease_expires_at: '2999-01-01T00:00:00.000Z',
            artifact_path: null,
            completed_at: null,
            started_at: '2026-11-02T14:00:00.000Z',
          }],
        };
      }
      if (normalized.includes('SELECT project_id, period_end FROM report_runs WHERE report_run_id = $1')) {
        return {
          rowCount: 1,
          rows: [{ project_id: 11, period_end: '2026-11-02T14:00:00.000Z' }],
        };
      }
      if (normalized.includes('SELECT report_run_id FROM report_runs WHERE project_id = $1 AND report_run_id <> $2')) {
        return { rowCount: 0, rows: [] };
      }
      if (normalized.includes('UPDATE projects SET latest_report_run_id = $1')) {
        return { rowCount: 1, rows: [] };
      }
      if (normalized.includes('UPDATE report_runs SET status = $2')) {
        return {
          rowCount: 1,
          rows: [{
            report_run_id: params[0],
            status: params[1],
            completed_at: params[2],
            failure_summary: params[4],
            artifact_path: params[5],
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const complete = await completeReportRun({
    db: fakeDb,
    runId: 'run-1',
    finalStatus: 'succeeded',
    artifactPath: stagedPath,
    now: new Date('2026-11-02T14:01:00Z'),
    reportDirectory: tempDir,
  });

  assert.equal(complete.status, 'succeeded');
  assert.equal(path.basename(complete.artifactPath), 'USF-PLAN-weekly-status-2026-11-02.pptx');
  assert.equal(nodeFs.existsSync(path.join(tempDir, 'latest.pptx')), true);
  assert.equal(nodeFs.existsSync(stagedPath), false);
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('expired report artifacts are removed and the latest pointer is cleared', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'usf-plan-artifact-retention-'));
  const datedPath = path.join(tempDir, 'USF-PLAN-weekly-status-2026-11-02.pptx');
  const latestPath = path.join(tempDir, 'latest.pptx');
  await fs.writeFile(datedPath, 'retained-artifact');
  await fs.writeFile(latestPath, 'latest-artifact');

  const fakeDb = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.includes('SELECT rr.report_run_id, rr.project_id, rr.artifact_path, rr.period_end, p.latest_report_run_id')) {
        return {
          rowCount: 1,
          rows: [{
            report_run_id: 'run-1',
            project_id: 11,
            artifact_path: datedPath,
            period_end: '2026-11-02T14:00:00.000Z',
            latest_report_run_id: 'run-1',
          }],
        };
      }
      if (normalized.includes('UPDATE projects SET latest_report_run_id = NULL')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const removed = await purgeExpiredReportArtifacts({ db: fakeDb, reportDirectory: tempDir, now: new Date('2027-11-03T00:00:00Z') });
  assert.equal(removed, 1);
  assert.equal(nodeFs.existsSync(datedPath), false);
  assert.equal(nodeFs.existsSync(latestPath), false);
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('capacity import returns an aggregate without retaining the person key', () => {
  const result = validateCsvRows('capacity', 'allocations',
    ['person_key', 'week_start', 'planned_hours'],
    [
      { person_key: 'person-a', week_start: '2026-10-26', planned_hours: '4.25' },
      { person_key: 'person-b', week_start: '2026-10-26', planned_hours: '3.25' },
    ]);
  assert.deepEqual(result, { capacityTotal: 7.5, weekStart: '2026-10-26' });
  assert.equal(JSON.stringify(result).includes('person-'), false);
});
