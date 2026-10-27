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
