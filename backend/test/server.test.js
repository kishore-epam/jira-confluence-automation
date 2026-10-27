'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, reportingPeriodEnd, validateCsvRows, validateUpdate } = require('../src/server');

test('reporting period stays open through the Monday 8:30 a.m. Eastern PM deadline', () => {
  assert.equal(reportingPeriodEnd(new Date('2026-10-26T12:29:00Z')), '2026-10-26');
  assert.equal(reportingPeriodEnd(new Date('2026-10-26T13:00:00Z')), '2026-11-02');
  assert.equal(reportingPeriodEnd(new Date('2026-10-27T12:00:00Z')), '2026-11-02');
});

test('reporting period boundary uses local Monday across the daylight-saving transition', () => {
  assert.equal(reportingPeriodEnd(new Date('2026-11-02T13:59:00Z')), '2026-11-02');
  assert.equal(reportingPeriodEnd(new Date('2026-11-02T14:00:00Z')), '2026-11-09');
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
