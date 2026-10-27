'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const HOST = '127.0.0.1';
const UI_ORIGIN = 'http://127.0.0.1:5173';
const PROJECT_KEY = 'USF-PLAN';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ROOT = path.resolve(__dirname, '..', '..');
const INPUT_DIR = path.join(ROOT, 'data', 'inputs');
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const schemaPath = path.join(__dirname, 'schema.sql');

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'usf_plan',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000,
});

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function errorResponse(res, status, code, message, details = []) {
  return res.status(status).json({ error: { code, message, details } });
}

function validUtcTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function asStringList(value, field, errors) {
  if (!Array.isArray(value) || value.length > 20
    || value.some((entry) => typeof entry !== 'string' || entry.length < 1 || entry.length > 500)) {
    errors.push({ field, message: 'Provide a list of up to 20 entries, each 1–500 characters.' });
    return [];
  }
  return value;
}

function validateUpdate(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [{ field: 'body', message: 'A JSON object is required.' }];
  }
  if (!['red', 'amber', 'green'].includes(body.ragStatus)) {
    errors.push({ field: 'ragStatus', message: 'Choose red, amber, or green.' });
  }
  if (typeof body.ragRationale !== 'string' || body.ragRationale.trim().length < 1
    || body.ragRationale.length > 2000) {
    errors.push({ field: 'ragRationale', message: 'Enter a rationale of 1–2,000 characters.' });
  }
  for (const field of [
    'accomplishments',
    'risksAndBlockers',
    'decisionsNeeded',
    'nextWeekPriorities',
    'milestoneChanges',
  ]) {
    if (!Object.hasOwn(body, field)) {
      errors.push({ field, message: 'This field is required; use an empty list when there is nothing to report.' });
    } else {
      asStringList(body[field], field, errors);
    }
  }
  return errors;
}

function reportingPeriodEnd(now = new Date()) {
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const localHour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now));
  const daysUntilMonday = daysSinceMonday === 0 && localHour < 9 ? 0 : (7 - daysSinceMonday);
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function clientSafeSummary(error) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return { status: 413, code: 'UPLOAD_TOO_LARGE', message: 'CSV uploads may not exceed 25 MiB.' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'The request could not be completed.' };
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return errorResponse(res, 403, 'LOOPBACK_ONLY', 'This service accepts loopback connections only.');
  }

  const allowedHosts = new Set([`127.0.0.1:${PORT}`, 'localhost:3000', '127.0.0.1:5173']);
  if (!allowedHosts.has(req.headers.host)) {
    return errorResponse(res, 400, 'INVALID_HOST', 'The request Host is not allowed.');
  }

  const origin = req.headers.origin;
  if (origin && origin !== UI_ORIGIN) {
    return errorResponse(res, 403, 'INVALID_ORIGIN', 'The request origin is not allowed.');
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !origin
    && !req.path.startsWith('/internal/')) {
    return errorResponse(res, 403, 'ORIGIN_REQUIRED', 'A local application origin is required.');
  }
  if (origin === UI_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', UI_ORIGIN);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ api: 'ready', database: 'ready' });
  } catch {
    res.status(503).json({ api: 'ready', database: 'unavailable' });
  }
});

app.get('/api/v1/dashboard', async (_req, res, next) => {
  try {
    const periodEnd = reportingPeriodEnd();
    const [updateResult, runsResult, inputResult] = await Promise.all([
      pool.query(
        `SELECT revision, rag_status, updated_at
         FROM project_updates
         WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
           AND period_end = $2::date
         ORDER BY revision DESC LIMIT 1`,
        [PROJECT_KEY, periodEnd],
      ),
      pool.query(
        `SELECT report_run_id, period_start, period_end, status, completed_at, failure_summary
         FROM report_runs
         WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
         ORDER BY created_at DESC LIMIT 1`,
        [PROJECT_KEY],
      ),
      pool.query(
        `SELECT source_type, dataset, validation_status, exported_at, coverage_start, coverage_end
         FROM source_inputs
         WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
           AND period_end = $2::date
         ORDER BY received_at DESC`,
        [PROJECT_KEY, periodEnd],
      ),
    ]);
    const latestInputs = new Map();
    for (const row of inputResult.rows) {
      const key = `${row.source_type}/${row.dataset}`;
      if (!latestInputs.has(key)) latestInputs.set(key, row);
    }
    const required = ['jira/issues', 'jira/sprints', 'jira/sprint-scope'];
    const missingRequired = required.filter((key) => latestInputs.get(key)?.validation_status !== 'accepted');
    res.json({
      projectKey: PROJECT_KEY,
      reportingPeriod: {
        startDate: new Date(new Date(`${periodEnd}T00:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10),
        endDate: periodEnd,
        timeZone: 'America/New_York',
        pmDeadline: 'Monday 8:30 a.m. Eastern',
        scheduledRun: 'Monday 9:00 a.m. Eastern',
      },
      projectUpdate: updateResult.rows[0] || null,
      latestRun: runsResult.rows[0] || null,
      sourceReadiness: {
        requiredJiraReady: missingRequired.length === 0,
        missingRequired,
        acceptedCount: [...latestInputs.values()].filter((item) => item.validation_status === 'accepted').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/project-updates', async (req, res, next) => {
  try {
    const periodEnd = req.query.periodEnd || reportingPeriodEnd();
    if (!validDate(periodEnd)) {
      return errorResponse(res, 422, 'VALIDATION_ERROR', 'The periodEnd must be an ISO local date.', [
        { field: 'periodEnd', message: 'Use YYYY-MM-DD.' },
      ]);
    }
    const result = await pool.query(
      `SELECT project_update_id, period_end, revision, rag_status, rag_rationale,
              accomplishments, risks_and_blockers, decisions_needed,
              next_week_priorities, milestone_changes, updated_at
       FROM project_updates
       WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
         AND period_end = $2::date
       ORDER BY revision DESC LIMIT 1`,
      [PROJECT_KEY, periodEnd],
    );
    if (!result.rowCount) return res.json({ periodEnd, update: null, complete: false });
    const row = result.rows[0];
    res.json({
      periodEnd,
      complete: true,
      update: {
        revision: row.revision,
        ragStatus: row.rag_status,
        ragRationale: row.rag_rationale,
        accomplishments: row.accomplishments,
        risksAndBlockers: row.risks_and_blockers,
        decisionsNeeded: row.decisions_needed,
        nextWeekPriorities: row.next_week_priorities,
        milestoneChanges: row.milestone_changes,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/v1/project-updates/:periodEnd', async (req, res, next) => {
  const periodEnd = req.params.periodEnd;
  if (!validDate(periodEnd)) {
    return errorResponse(res, 422, 'VALIDATION_ERROR', 'The reporting period must be an ISO local date.', [
      { field: 'periodEnd', message: 'Use YYYY-MM-DD.' },
    ]);
  }
  const errors = validateUpdate(req.body);
  if (errors.length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Correct the highlighted fields.', errors);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query('SELECT project_id FROM projects WHERE project_key = $1', [PROJECT_KEY]);
    const projectId = project.rows[0].project_id;
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [PROJECT_KEY, periodEnd],
    );
    const revision = await client.query(
      `SELECT COALESCE(MAX(revision), 0) + 1 AS next_revision
       FROM project_updates WHERE project_id = $1 AND period_end = $2::date`,
      [projectId, periodEnd],
    );
    const body = req.body;
    const saved = await client.query(
      `INSERT INTO project_updates (
         project_id, period_end, revision, rag_status, rag_rationale,
         accomplishments, risks_and_blockers, decisions_needed,
         next_week_priorities, milestone_changes
       ) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING project_update_id, revision, updated_at`,
      [
        projectId, periodEnd, revision.rows[0].next_revision, body.ragStatus,
        body.ragRationale.trim(), JSON.stringify(body.accomplishments),
        JSON.stringify(body.risksAndBlockers), JSON.stringify(body.decisionsNeeded),
        JSON.stringify(body.nextWeekPriorities), JSON.stringify(body.milestoneChanges),
      ],
    );
    await client.query('COMMIT');
    res.status(201).json({
      periodEnd,
      revision: saved.rows[0].revision,
      savedAt: saved.rows[0].updated_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

const CSV_CONTRACTS = {
  jira: {
    issues: ['issue_key', 'title', 'status', 'status_category', 'updated_at_utc', 'in_progress_since_utc', 'story_points', 'issue_type', 'client_shareable'],
    sprints: ['sprint_id', 'name', 'state', 'start_at_utc', 'end_at_utc'],
    'sprint-scope': ['sprint_id', 'issue_key', 'event_type', 'event_at_utc', 'story_points_at_event'],
    worklogs: ['worklog_id', 'issue_key', 'started_at_utc', 'hours'],
    'issue-links': ['link_id', 'source_issue_key', 'target_issue_key', 'link_type'],
    milestones: ['milestone_id', 'name', 'status', 'due_date_local', 'client_shareable'],
  },
  git: { commits: ['repository', 'commit_sha', 'committed_at_utc'] },
  confluence: { pages: ['page_id', 'title', 'url', 'updated_at_utc', 'summary', 'client_shareable'] },
  capacity: { allocations: ['person_key', 'week_start', 'planned_hours'] },
  'pm-template': {
    'weekly-update': ['period_end_local_date', 'rag_status', 'rag_rationale', 'accomplishments', 'risks_and_blockers', 'decisions_needed', 'next_week_priorities', 'milestone_changes'],
  },
};

function parseCsv(buffer) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  if (text.includes('\u0000')) throw new Error('CSV contains unsupported binary data.');
  const rows = parse(text, { bom: true, skip_empty_lines: true, trim: true, relax_column_count: false });
  if (!rows.length) throw new Error('CSV must include a header row.');
  const headers = rows[0];
  if (headers.length === 0 || new Set(headers).size !== headers.length) {
    throw new Error('CSV must have a unique header row.');
  }
  const records = rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  return { headers, records };
}

function validateCsvRows(sourceType, dataset, headers, rows, statusMapping = {}) {
  const required = CSV_CONTRACTS[sourceType]?.[dataset];
  if (!required) return 'This source and dataset are not supported.';
  const unknown = headers.filter((header) => !required.includes(header));
  const missing = required.filter((header) => !headers.includes(header));
  if (unknown.length || missing.length) {
    return `CSV columns do not match the ${sourceType}/${dataset} contract.`;
  }
  if (sourceType === 'pm-template' && rows.length !== 1) {
    return 'The PM template must contain exactly one data row.';
  }
  if (rows.length === 0 && !(sourceType === 'jira' && ['issues', 'sprint-scope'].includes(dataset))) {
    return 'This dataset must contain at least one data row.';
  }
  if (rows.some((row) => Object.values(row).some((value) => typeof value !== 'string'))) {
    return 'CSV row values must be text.';
  }
  const isUnique = (field) => new Set(rows.map((row) => row[field])).size === rows.length;
  const validTimestamps = (fields) => rows.every((row) =>
    fields.every((field) => !row[field] || validUtcTimestamp(row[field])));
  if (sourceType === 'jira' && dataset === 'issues') {
    const mapping = statusMapping && typeof statusMapping === 'object' && !Array.isArray(statusMapping)
      ? statusMapping
      : {};
    if (rows.some((row) => !Object.hasOwn(mapping, row.status) || mapping[row.status] !== row.status_category)) {
      return 'Jira issues contain an unknown or mismatched status/category mapping.';
    }
    if (!isUnique('issue_key')
      || rows.some((row) => !['todo', 'in_progress', 'done'].includes(row.status_category)
        || !['true', 'false'].includes(row.client_shareable)
        || (row.story_points !== '' && (!Number.isFinite(Number(row.story_points)) || Number(row.story_points) < 0))
        || (row.status_category === 'in_progress' && row.in_progress_since_utc && !validUtcTimestamp(row.in_progress_since_utc)))
      || !validTimestamps(['updated_at_utc', 'in_progress_since_utc'])) {
      return 'Jira issues contain duplicate keys or invalid status, estimate, sharing, or timestamp values.';
    }
  }
  if (sourceType === 'jira' && dataset === 'sprints') {
    const active = rows.filter((row) => row.state.toLowerCase() === 'active');
    if (active.length !== 1 || !isUnique('sprint_id') || !validTimestamps(['start_at_utc', 'end_at_utc'])) {
      return 'Jira sprints must contain one active sprint and unique IDs with valid timestamps.';
    }
  }
  if (sourceType === 'jira' && dataset === 'sprint-scope'
    && (!validTimestamps(['event_at_utc'])
      || rows.some((row) => !['added', 'removed'].includes(row.event_type)
        || !Number.isFinite(Number(row.story_points_at_event)) || Number(row.story_points_at_event) < 0))) {
    return 'Sprint scope contains invalid events, estimates, or timestamps.';
  }
  if (sourceType === 'jira' && dataset === 'worklogs'
    && (!isUnique('worklog_id')
      || rows.some((row) => !validUtcTimestamp(row.started_at_utc)
        || !/^\d+(?:\.\d+)?$/.test(row.hours)
        || !Number.isFinite(Number(row.hours))
        || Number(row.hours) < 0))) {
    return 'Jira worklogs contain duplicate IDs or invalid hours/timestamps.';
  }
  if (sourceType === 'jira' && dataset === 'issue-links' && !isUnique('link_id')) {
    return 'Jira issue links contain duplicate identifiers.';
  }
  if (sourceType === 'jira' && dataset === 'milestones'
    && (!isUnique('milestone_id') || rows.some((row) =>
      !['true', 'false'].includes(row.client_shareable) || !validDate(row.due_date_local)))) {
    return 'Jira milestones contain duplicate IDs or invalid sharing/date values.';
  }
  if (sourceType === 'git' && (!isUnique('commit_sha') || !validTimestamps(['committed_at_utc']))) {
    return 'Git commits contain duplicate hashes or invalid timestamps.';
  }
  if (sourceType === 'confluence' && (!isUnique('page_id') || !validTimestamps(['updated_at_utc'])
    || rows.some((row) => !['true', 'false'].includes(row.client_shareable)))) {
    return 'Confluence pages contain duplicate IDs or invalid sharing/timestamp values.';
  }
  if (sourceType === 'pm-template'
    && (!validDate(rows[0]?.period_end_local_date)
      || !['red', 'amber', 'green'].includes(rows[0]?.rag_status?.toLowerCase())
      || !rows[0]?.rag_rationale?.trim())) {
    return 'PM template contains an invalid period, RAG status, or rationale.';
  }
  if (sourceType === 'capacity') {
    const keys = new Set();
    let total = 0;
    for (const row of rows) {
      const key = `${row.person_key}|${row.week_start}`;
      const hours = Number(row.planned_hours);
      if (keys.has(key) || !validDate(row.week_start) || !Number.isFinite(hours) || hours < 0) {
        return 'Capacity rows contain a duplicate allocation or invalid week/hours value.';
      }
      keys.add(key);
      total += hours;
    }
    return { capacityTotal: Math.round(total * 10) / 10, weekStart: rows[0].week_start };
  }
  return null;
}

app.post('/api/v1/source-inputs/:sourceType/:dataset', upload.single('file'), async (req, res, next) => {
  try {
    const { sourceType, dataset } = req.params;
    const metadata = req.body || {};
    if (!req.file || !req.file.originalname.toLowerCase().endsWith('.csv')
      || req.file.originalname.includes('/') || req.file.originalname.includes('\\')) {
      return errorResponse(res, 422, 'INVALID_UPLOAD', 'Choose one plain CSV file with a safe filename.', [
        { field: 'file', message: 'Only a CSV filename is accepted.' },
      ]);
    }
    if (!validUtcTimestamp(metadata.exportedAtUtc)
      || !validUtcTimestamp(metadata.coverageStartUtc)
      || !validUtcTimestamp(metadata.coverageEndUtc)
      || Date.parse(metadata.coverageStartUtc) >= Date.parse(metadata.coverageEndUtc)
      || metadata.projectKey !== PROJECT_KEY) {
      return errorResponse(res, 422, 'INVALID_METADATA', 'Provide valid UTC timestamps, an increasing coverage interval, and project key USF-PLAN.');
    }
    const requiredAttestation = (sourceType === 'jira' && ['issues', 'milestones'].includes(dataset))
      || (sourceType === 'confluence' && dataset === 'pages');
    if (requiredAttestation && metadata.clientSharingAttested !== 'true') {
      return errorResponse(res, 422, 'ATTESTATION_REQUIRED', 'Confirm that client-sharing flags were reviewed.');
    }

    let parsed;
    let validation;
    let issueStatusMapping = {};
    if (sourceType === 'jira' && dataset === 'issues') {
      const settings = await pool.query(
        `SELECT status_mapping
         FROM reporting_settings
         WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
         ORDER BY settings_version_id DESC LIMIT 1`,
        [PROJECT_KEY],
      );
      if (!settings.rowCount) {
        return errorResponse(res, 503, 'STATUS_MAPPING_UNAVAILABLE', 'A configured Jira status mapping is required to validate issue exports.');
      }
      issueStatusMapping = settings.rows[0].status_mapping;
    }
    try {
      parsed = parseCsv(req.file.buffer);
      validation = validateCsvRows(sourceType, dataset, parsed.headers, parsed.records, issueStatusMapping);
    } catch (error) {
      validation = error instanceof TypeError ? 'CSV must be valid UTF-8.' : 'CSV could not be parsed safely.';
    }
    let validationMessage = typeof validation === 'string' ? validation : null;
    if (!validationMessage && ['git', 'confluence'].includes(sourceType)) {
      const settings = await pool.query(
        `SELECT allowed_git_repositories, allowed_confluence_scope
         FROM reporting_settings
         WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
         ORDER BY settings_version_id DESC LIMIT 1`,
        [PROJECT_KEY],
      );
      if (sourceType === 'git') {
        const allowlist = settings.rows[0].allowed_git_repositories;
        if (!allowlist.length || parsed.records.some((row) => !allowlist.includes(row.repository))) {
          validationMessage = 'Git input is not within a configured repository allowlist.';
        }
      } else {
        const allowlist = settings.rows[0].allowed_confluence_scope;
        if (!allowlist.length || parsed.records.some((row) => {
          try {
            const pageUrl = new URL(row.url);
            return pageUrl.username || pageUrl.password || pageUrl.search || pageUrl.hash
              || !allowlist.some((scope) => row.url.startsWith(scope));
          } catch {
            return true;
          }
        })) {
          validationMessage = 'Confluence input is not within a configured space allowlist.';
        }
      }
    }
    const accepted = !validationMessage;
    if (accepted && sourceType === 'pm-template'
      && parsed.records[0].period_end_local_date !== reportingPeriodEnd()) {
      return errorResponse(res, 422, 'PERIOD_MISMATCH', 'The PM template period does not match the current reporting period.');
    }
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const periodEnd = reportingPeriodEnd();
    const inputId = crypto.randomUUID();
    let storageKey = null;
    if (accepted && sourceType !== 'capacity' && sourceType !== 'pm-template') {
      await fs.mkdir(INPUT_DIR, { recursive: true });
      storageKey = `${inputId}.csv`;
      await fs.writeFile(path.join(INPUT_DIR, storageKey), req.file.buffer, { flag: 'wx' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const projectId = (await client.query(
        'SELECT project_id FROM projects WHERE project_key = $1',
        [PROJECT_KEY],
      )).rows[0].project_id;
      const prior = await client.query(
        `SELECT source_input_id FROM source_inputs
         WHERE project_id = $1 AND period_end = $2::date AND source_type = $3 AND dataset = $4
         ORDER BY received_at DESC LIMIT 1`,
        [projectId, periodEnd, sourceType, dataset],
      );
      await client.query(
        `INSERT INTO source_inputs (
           source_input_id, project_id, period_end, source_type, dataset, storage_key,
           content_hash, exported_at, coverage_start, coverage_end, validation_status,
           validation_summary, client_sharing_attested_at, retention_until, supersedes_source_input_id
         ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          inputId, projectId, periodEnd, sourceType, dataset, storageKey, hash,
          metadata.exportedAtUtc, metadata.coverageStartUtc, metadata.coverageEndUtc,
          accepted ? 'accepted' : 'rejected',
          validationMessage || 'CSV structure validated; detailed source row checks are limited in this prototype.',
          requiredAttestation ? new Date() : null,
          storageKey ? new Date(Date.now() + 7 * 86400000) : null,
          prior.rows[0]?.source_input_id || null,
        ],
      );
      if (accepted && sourceType === 'capacity') {
        await client.query(
          `INSERT INTO capacity_aggregates (project_id, week_start, planned_hours_total, source_input_id)
           VALUES ($1, $2::date, $3, $4)
           ON CONFLICT (project_id, week_start) DO UPDATE SET
             planned_hours_total = EXCLUDED.planned_hours_total,
             source_input_id = EXCLUDED.source_input_id,
             created_at = now()`,
          [projectId, validation.weekStart, validation.capacityTotal, inputId],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (storageKey) await fs.rm(path.join(INPUT_DIR, storageKey), { force: true });
      throw error;
    } finally {
      client.release();
    }

    if (sourceType === 'pm-template' && accepted) {
      const row = parsed.records[0];
      return res.status(201).json({
        accepted: true,
        draft: {
          periodEnd: row.period_end_local_date,
          ragStatus: row.rag_status.toLowerCase(),
          ragRationale: row.rag_rationale,
          accomplishments: row.accomplishments ? row.accomplishments.split('|') : [],
          risksAndBlockers: row.risks_and_blockers ? row.risks_and_blockers.split('|') : [],
          decisionsNeeded: row.decisions_needed ? row.decisions_needed.split('|') : [],
          nextWeekPriorities: row.next_week_priorities ? row.next_week_priorities.split('|') : [],
          milestoneChanges: row.milestone_changes ? row.milestone_changes.split('|') : [],
        },
      });
    }
    res.status(accepted ? 201 : 422).json({
      sourceInputId: inputId,
      accepted,
      validationSummary: validationMessage || 'CSV structure validated.',
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/source-inputs', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT source_input_id, source_type, dataset, validation_status, validation_summary,
              exported_at, coverage_start, coverage_end, received_at
       FROM source_inputs
       WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
       ORDER BY received_at DESC LIMIT 100`,
      [PROJECT_KEY],
    );
    res.json({ items: result.rows.map((row) => ({
      sourceInputId: row.source_input_id,
      sourceType: row.source_type,
      dataset: row.dataset,
      status: row.validation_status,
      summary: row.validation_summary,
      exportedAt: row.exported_at,
      coverageStart: row.coverage_start,
      coverageEnd: row.coverage_end,
      receivedAt: row.received_at,
    })) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/sources', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT source_type, dataset, validation_status, exported_at, coverage_start,
              coverage_end, received_at, validation_summary
       FROM source_inputs
       WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
       ORDER BY received_at DESC`,
      [PROJECT_KEY],
    );
    const latest = new Map();
    for (const item of result.rows) {
      const key = `${item.source_type}/${item.dataset}`;
      if (!latest.has(key)) latest.set(key, item);
    }
    const known = [
      ['jira', 'issues', true], ['jira', 'sprints', true], ['jira', 'sprint-scope', true],
      ['jira', 'worklogs', false], ['jira', 'issue-links', false], ['jira', 'milestones', false],
      ['git', 'commits', false], ['confluence', 'pages', false], ['capacity', 'allocations', false],
      ['deployment', 'releases', false],
    ];
    res.json({
      items: known.map(([sourceType, dataset, required]) => {
        const row = latest.get(`${sourceType}/${dataset}`);
        return {
          sourceType,
          dataset,
          required,
          status: row ? row.validation_status : (sourceType === 'deployment' ? 'unavailable' : 'missing'),
          exportedAt: row?.exported_at || null,
          coverageStart: row?.coverage_start || null,
          coverageEnd: row?.coverage_end || null,
          warning: row?.validation_summary || (required ? 'Required input has not been uploaded.' : 'Optional source is not configured.'),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/report-settings', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT issue_stale_business_days, in_progress_stale_calendar_days,
              source_freshness_days, status_mapping, allowed_git_repositories,
              allowed_confluence_scope, settings_version_id, change_reason, effective_at
       FROM reporting_settings
       WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
       ORDER BY settings_version_id DESC LIMIT 1`,
      [PROJECT_KEY],
    );
    const row = result.rows[0];
    res.json({
      version: row.settings_version_id,
      issueStaleBusinessDays: row.issue_stale_business_days,
      inProgressStaleCalendarDays: row.in_progress_stale_calendar_days,
      sourceFreshnessDays: row.source_freshness_days,
      statusMapping: row.status_mapping,
      allowedGitRepositories: row.allowed_git_repositories,
      allowedConfluenceScope: row.allowed_confluence_scope,
      changeReason: row.change_reason,
      effectiveAt: row.effective_at,
      forecast: { enabled: false, status: 'unavailable' },
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/v1/report-settings', async (req, res, next) => {
  const body = req.body;
  const errors = [];
  if (!body || typeof body !== 'object') errors.push({ field: 'body', message: 'A JSON object is required.' });
  if (!Number.isInteger(body?.issueStaleBusinessDays) || body.issueStaleBusinessDays < 1 || body.issueStaleBusinessDays > 100) {
    errors.push({ field: 'issueStaleBusinessDays', message: 'Choose an integer from 1 to 100.' });
  }
  if (!Number.isInteger(body?.inProgressStaleCalendarDays) || body.inProgressStaleCalendarDays < 1 || body.inProgressStaleCalendarDays > 365) {
    errors.push({ field: 'inProgressStaleCalendarDays', message: 'Choose an integer from 1 to 365.' });
  }
  if (!Number.isInteger(body?.sourceFreshnessDays) || body.sourceFreshnessDays < 1 || body.sourceFreshnessDays > 365) {
    errors.push({ field: 'sourceFreshnessDays', message: 'Choose an integer from 1 to 365.' });
  }
  if (typeof body?.changeReason !== 'string' || body.changeReason.trim().length < 1 || body.changeReason.length > 500) {
    errors.push({ field: 'changeReason', message: 'Enter a reason of 1–500 characters.' });
  }
  for (const [field, values] of [
    ['allowedGitRepositories', body?.allowedGitRepositories],
    ['allowedConfluenceScope', body?.allowedConfluenceScope],
  ]) {
    if (values !== undefined && (!Array.isArray(values) || values.length > 50
      || values.some((value) => typeof value !== 'string' || value.trim().length < 1 || value.length > 300))) {
      errors.push({ field, message: 'Provide up to 50 non-empty allowlist entries, each no longer than 300 characters.' });
    }
  }
  if (body?.statusMapping !== undefined && (!body.statusMapping || typeof body.statusMapping !== 'object'
    || Array.isArray(body.statusMapping)
    || Object.values(body.statusMapping).some((value) => !['todo', 'in_progress', 'done'].includes(value)))) {
    errors.push({ field: 'statusMapping', message: 'Map source statuses only to todo, in_progress, or done.' });
  }
  if (errors.length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Correct the settings fields.', errors);
  try {
    const result = await pool.query(
      `INSERT INTO reporting_settings (
         project_id, issue_stale_business_days, in_progress_stale_calendar_days,
         source_freshness_days, status_mapping, allowed_git_repositories,
         allowed_confluence_scope, change_reason
       ) VALUES (
         (SELECT project_id FROM projects WHERE project_key = $1), $2, $3, $4, $5::jsonb, $6, $7, $8
       ) RETURNING settings_version_id, effective_at`,
      [
        PROJECT_KEY,
        body.issueStaleBusinessDays,
        body.inProgressStaleCalendarDays,
        body.sourceFreshnessDays,
        JSON.stringify(body.statusMapping || { 'To Do': 'todo', 'In Progress': 'in_progress', Done: 'done' }),
        body.allowedGitRepositories || [],
        body.allowedConfluenceScope || [],
        body.changeReason.trim(),
      ],
    );
    res.status(201).json({ version: result.rows[0].settings_version_id, effectiveAt: result.rows[0].effective_at });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/report-runs', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const result = await pool.query(
      `SELECT report_run_id, period_start, period_end, status, completed_at,
              failure_summary, artifact_path
       FROM report_runs
       WHERE project_id = (SELECT project_id FROM projects WHERE project_key = $1)
       ORDER BY created_at DESC LIMIT $2`,
      [PROJECT_KEY, limit],
    );
    res.json({ items: result.rows.map((row) => ({
      runId: row.report_run_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      completedAt: row.completed_at,
      warningSummary: row.failure_summary,
      artifactAvailable: Boolean(row.artifact_path),
    })) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/report-runs/:runId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT report_run_id, period_start, period_end, status, scheduled_at,
              started_at, completed_at, failure_code, failure_summary,
              previous_success_preserved, artifact_path
       FROM report_runs WHERE report_run_id = $1`,
      [req.params.runId],
    );
    if (!result.rowCount) return res.sendStatus(404);
    const run = result.rows[0];
    res.json({
      runId: run.report_run_id,
      periodStart: run.period_start,
      periodEnd: run.period_end,
      status: run.status,
      scheduledAt: run.scheduled_at,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      failureCode: run.failure_code,
      failureSummary: run.failure_summary,
      previousSuccessPreserved: run.previous_success_preserved,
      artifactAvailable: Boolean(run.artifact_path),
      latestReview: null,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/report-runs/:runId/review', async (req, res, next) => {
  const { decision, notes = null } = req.body || {};
  if (!['approved', 'changes_requested'].includes(decision)
    || (notes !== null && (typeof notes !== 'string' || notes.length > 2000))) {
    return errorResponse(res, 422, 'VALIDATION_ERROR', 'Choose a review decision and provide an optional note up to 2,000 characters.');
  }
  try {
    const run = await pool.query('SELECT status FROM report_runs WHERE report_run_id = $1', [req.params.runId]);
    if (!run.rowCount) return res.sendStatus(404);
    if (!['succeeded', 'partial'].includes(run.rows[0].status)) {
      return errorResponse(res, 409, 'RUN_NOT_REVIEWABLE', 'Only completed reports can be reviewed.');
    }
    const review = await pool.query(
      `INSERT INTO report_reviews (report_run_id, decision, notes)
       VALUES ($1, $2, $3)
       RETURNING decision, notes, actor_label, reviewed_at`,
      [req.params.runId, decision, notes],
    );
    res.status(201).json(review.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/report-runs/:runId/artifact', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT status, artifact_path FROM report_runs WHERE report_run_id = $1',
      [req.params.runId],
    );
    if (!result.rowCount || !result.rows[0].artifact_path) return res.sendStatus(404);
    const artifactPath = path.resolve(REPORT_DIR, result.rows[0].artifact_path);
    if (!artifactPath.startsWith(`${REPORT_DIR}${path.sep}`)) return res.sendStatus(404);
    await fs.access(artifactPath);
    res.download(artifactPath);
  } catch (error) {
    if (error.code === 'ENOENT') return res.sendStatus(404);
    next(error);
  }
});

function requireWorkerToken(req, res, next) {
  const configured = process.env.USF_PLAN_WORKER_TOKEN || '';
  const authorization = req.headers.authorization || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!configured || !safeEqual(supplied, configured)) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'A valid worker credential is required.');
  }
  next();
}

app.post('/internal/v1/report-runs/claim', requireWorkerToken, (_req, res) => {
  res.status(501).json({ error: { code: 'WORKER_UNAVAILABLE', message: 'Scheduled report execution is not configured.' } });
});
app.post('/internal/v1/report-runs/:runId/heartbeat', requireWorkerToken, (_req, res) => {
  res.status(501).json({ error: { code: 'WORKER_UNAVAILABLE', message: 'Scheduled report execution is not configured.' } });
});
app.post('/internal/v1/report-runs/:runId/complete', requireWorkerToken, (_req, res) => {
  res.status(501).json({ error: { code: 'WORKER_UNAVAILABLE', message: 'Scheduled report execution is not configured.' } });
});

app.use((req, res) => errorResponse(res, 404, 'NOT_FOUND', 'The requested route was not found.'));
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 413, 'UPLOAD_TOO_LARGE', 'CSV uploads may not exceed 25 MiB.');
  }
  const correlationId = res.getHeader('X-Request-Id');
  console.error(JSON.stringify({ event: 'request_failed', correlationId, code: error.code || 'INTERNAL_ERROR' }));
  const summary = clientSafeSummary(error);
  errorResponse(res, summary.status, summary.code, summary.message);
});

async function start() {
  if (!process.env.PGUSER || !process.env.PGPASSWORD) {
    throw new Error('PostgreSQL credentials must be provided through the approved local startup wrapper.');
  }
  await fs.mkdir(INPUT_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await pool.query(await fs.readFile(schemaPath, 'utf8'));
  app.listen(PORT, HOST, () => {
    console.log(`USF-PLAN API listening at http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`API startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { app, pool, parseCsv, reportingPeriodEnd, validateCsvRows, validateUpdate };
