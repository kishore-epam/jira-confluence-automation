'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
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
