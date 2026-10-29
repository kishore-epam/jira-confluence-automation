import { useCallback, useEffect, useMemo, useState } from 'react';

const navigation = [
  ['dashboard', 'Overview'],
  ['update', 'Weekly update'],
  ['inputs', 'Source inputs'],
  ['readiness', 'Source readiness'],
  ['reports', 'Report history'],
  ['settings', 'Settings'],
];

const emptyUpdate = {
  ragStatus: 'green',
  ragRationale: '',
  accomplishments: [],
  risksAndBlockers: [],
  decisionsNeeded: [],
  nextWeekPriorities: [],
  milestoneChanges: [],
};

async function request(path, options = {}) {
  const response = await fetch(path, options);
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = payload?.error;
    throw new Error(error?.message || `Request failed (${response.status}).`);
  }
  return payload;
}

function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Notice({ tone = 'info', children }) {
  return <div className={`notice notice-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>{children}</div>;
}

function Loading() {
  return <p className="muted" role="status">Loading…</p>;
}

function ErrorNotice({ error }) {
  return error ? <Notice tone="danger">{error}</Notice> : null;
}

function linesToList(value) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function listToLines(value) {
  if (Array.isArray(value)) return value.join('\n');
  return typeof value === 'string' ? value : '';
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [toast, setToast] = useState('');
  const [updateDraft, setUpdateDraft] = useState(null);

  const refreshDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setDashboardError('');
    try {
      setDashboard(await request('/api/v1/dashboard'));
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => { refreshDashboard(); }, [refreshDashboard]);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }, []);

  const currentPage = useMemo(() => navigation.find(([key]) => key === page), [page]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={() => setPage('dashboard')}>
          <span className="brand-mark">U</span>
          <span><strong>USF-PLAN</strong><small>Weekly status</small></span>
        </a>
        <div className="side-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(([key, label], index) => (
            <button
              className={`nav-item ${page === key ? 'active' : ''}`}
              key={key}
              onClick={() => setPage(key)}
              aria-current={page === key ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{['◫', '✎', '↑', '◉', '▤', '⚙'][index]}</span>
              {label}
              {key === 'inputs' && dashboard?.sourceReadiness?.missingRequired?.length > 0
                ? <span className="nav-count">{dashboard.sourceReadiness.missingRequired.length}</span>
                : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-indicator" />
          <div><strong>Local workspace</strong><small>Only this computer</small></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span className="breadcrumb">USF-PLAN <span>/</span> {currentPage?.[1]}</span>
          <div className="topbar-right">
            <span className="secure-label"><span aria-hidden="true">●</span> Local only</span>
            <span className="avatar" aria-label="Local project manager">PM</span>
          </div>
        </header>
        <section className="content">
          {toast && <div className="toast" role="status">{toast}</div>}
          {page === 'dashboard' && (
            <Dashboard
              dashboard={dashboard}
              loading={loadingDashboard}
              error={dashboardError}
              onNavigate={setPage}
              onRefresh={refreshDashboard}
            />
          )}
          {page === 'update' && (
            <WeeklyUpdate
              periodEnd={dashboard?.reportingPeriod?.endDate}
              draft={updateDraft}
              onSaved={async () => { setUpdateDraft(null); notify('Weekly update saved.'); await refreshDashboard(); }}
            />
          )}
          {page === 'inputs' && (
            <SourceInputs
              periodEnd={dashboard?.reportingPeriod?.endDate}
              periodStart={dashboard?.reportingPeriod?.startDate}
              onDraftImported={setUpdateDraft}
              onUploaded={async (message) => { notify(message); await refreshDashboard(); }}
            />
          )}
          {page === 'readiness' && <SourceReadiness />}
          {page === 'reports' && <ReportHistory />}
          {page === 'settings' && <Settings onSaved={notify} />}
        </section>
      </main>
    </div>
  );
}

function Dashboard({ dashboard, loading, error, onNavigate, onRefresh }) {
  if (loading) return <Loading />;
  if (error) return <><PageTitle eyebrow="PROJECT CONTROL" title="Weekly overview" description="Your weekly reporting workspace." /><ErrorNotice error={error} /><button className="button button-secondary" onClick={onRefresh}>Try again</button></>;
  if (!dashboard) return <Notice tone="danger">Dashboard data was not returned by the API.</Notice>;

  const updateComplete = Boolean(dashboard.projectUpdate);
  const missing = dashboard.sourceReadiness.missingRequired;
  return (
    <>
      <PageTitle
        eyebrow="PROJECT CONTROL"
        title="Weekly overview"
        description="A single place to prepare, validate, and review the USF-PLAN weekly status report."
        action={<button className="button button-secondary" onClick={onRefresh}>Refresh</button>}
      />
      <div className="period-banner">
        <div className="period-icon">◷</div>
        <div>
          <span className="banner-label">CURRENT REPORTING PERIOD · AMERICA/NEW_YORK</span>
          <strong>{dashboard.reportingPeriod.startDate} – {dashboard.reportingPeriod.endDate}</strong>
          <span className="muted">PM update due {dashboard.reportingPeriod.pmDeadline} · Scheduled report {dashboard.reportingPeriod.scheduledRun}</span>
        </div>
        <button className="button button-light" onClick={() => onNavigate('update')}>Prepare weekly update <span aria-hidden="true">→</span></button>
      </div>

      {missing.length > 0 && (
        <Notice tone="warning">
          Required Jira inputs are missing: <strong>{missing.join(', ')}</strong>. Upload current exports before the scheduled run.
        </Notice>
      )}
      {!updateComplete && (
        <Notice tone="warning">
          The project-manager update is not saved for this period. Add the RAG rationale and narrative before the Monday deadline.
        </Notice>
      )}

      <div className="metrics-grid">
        <MetricCard label="PM update" value={updateComplete ? 'Ready' : 'Not started'} detail={updateComplete ? `Revision ${dashboard.projectUpdate.revision}` : 'Narrative is required'} tone={updateComplete ? 'green' : 'amber'} icon="✎" />
        <MetricCard label="Required Jira inputs" value={`${3 - missing.length} / 3`} detail={missing.length ? 'Issues, sprint & scope' : 'All required datasets received'} tone={missing.length ? 'amber' : 'green'} icon="⇧" />
        <MetricCard label="Latest report" value={dashboard.latestRun?.status || 'Not run'} detail={dashboard.latestRun ? dashboard.latestRun.completed_at || 'Scheduled workflow' : 'No completed report yet'} tone={dashboard.latestRun ? 'blue' : 'neutral'} icon="▤" />
      </div>

      <div className="section-heading">
        <div><h2>Reporting workflow</h2><p>Complete each preparation step before the scheduled run.</p></div>
      </div>
      <div className="workflow-grid">
        <WorkflowCard number="01" title="Write the weekly update" body="Set the project RAG and capture progress, risks, decisions, and next-week priorities." status={updateComplete ? 'Complete' : 'Action needed'} tone={updateComplete ? 'green' : 'amber'} onClick={() => onNavigate('update')} />
        <WorkflowCard number="02" title="Provide source exports" body="Upload controlled CSVs and review validation results and source freshness." status={missing.length ? `${missing.length} required missing` : 'Required inputs ready'} tone={missing.length ? 'amber' : 'green'} onClick={() => onNavigate('inputs')} />
        <WorkflowCard number="03" title="Review the report" body="Inspect the scheduled PowerPoint, confirm the measures, then record your review." status={dashboard.latestRun?.status || 'Awaiting scheduled worker'} tone="blue" onClick={() => onNavigate('reports')} />
      </div>
      <Notice>
        Reports are generated by the scheduled workflow only. This prototype does not provide a manual “run now” action or automatically send reports.
      </Notice>
    </>
  );
}

function MetricCard({ label, value, detail, tone, icon }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div className="metric-main"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      <span className={`status-dot ${tone}`} />
    </article>
  );
}

function WorkflowCard({ number, title, body, status, tone, onClick }) {
  return (
    <button className="workflow-card" onClick={onClick}>
      <div className="workflow-number">{number}</div>
      <strong>{title}</strong>
      <p>{body}</p>
      <span className={`pill ${tone}`}>{status}</span>
      <span className="workflow-arrow" aria-hidden="true">→</span>
    </button>
  );
}

function WeeklyUpdate({ periodEnd, draft, onSaved }) {
  const [form, setForm] = useState(emptyUpdate);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!periodEnd) return;
    let active = true;
    request(`/api/v1/project-updates?periodEnd=${encodeURIComponent(periodEnd)}`)
      .then((response) => {
        if (active && draft?.periodEnd === periodEnd) setForm(draft);
        else if (active && response.update) setForm(response.update);
        if (active) setStatus('ready');
      })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } });
    return () => { active = false; };
  }, [periodEnd, draft]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await request(`/api/v1/project-updates/${periodEnd}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ragStatus: form.ragStatus,
          ragRationale: form.ragRationale,
          accomplishments: Array.isArray(form.accomplishments) ? form.accomplishments : linesToList(form.accomplishments),
          risksAndBlockers: Array.isArray(form.risksAndBlockers) ? form.risksAndBlockers : linesToList(form.risksAndBlockers),
          decisionsNeeded: Array.isArray(form.decisionsNeeded) ? form.decisionsNeeded : linesToList(form.decisionsNeeded),
          nextWeekPriorities: Array.isArray(form.nextWeekPriorities) ? form.nextWeekPriorities : linesToList(form.nextWeekPriorities),
          milestoneChanges: Array.isArray(form.milestoneChanges) ? form.milestoneChanges : linesToList(form.milestoneChanges),
        }),
      });
      await onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorNotice error={error} />;
  if (!periodEnd) return <Notice tone="warning">Reporting period is not available until the API responds.</Notice>;

  const listFields = [
    ['accomplishments', 'Accomplishments', 'What changed or was delivered this week?'],
    ['risksAndBlockers', 'Risks & blockers', 'One item per line.'],
    ['decisionsNeeded', 'Decisions needed', 'Decisions that need leadership attention.'],
    ['nextWeekPriorities', 'Next-week priorities', 'One priority per line.'],
    ['milestoneChanges', 'Milestone changes', 'Changes to milestone dates or status.'],
  ];

  return (
    <>
      <PageTitle eyebrow="WEEKLY INPUT" title="Project-manager update" description="Your narrative is the authoritative context used in the weekly report." />
      <div className="subtle-strip"><span>Reporting period</span><strong>{periodEnd}</strong><span>·</span><span>Deadline: Monday 8:30 a.m. Eastern</span></div>
      <ErrorNotice error={error} />
      <form className="panel form-panel" onSubmit={save}>
        <div className="form-section">
          <div className="form-section-heading"><div><h2>Overall health</h2><p>Choose the status; the application does not infer RAG from metrics.</p></div><span className="required-label">Required</span></div>
          <div className="rag-options" role="radiogroup" aria-label="Overall RAG status">
            {['green', 'amber', 'red'].map((value) => (
              <label className={`rag-option ${value} ${form.ragStatus === value ? 'selected' : ''}`} key={value}>
                <input type="radio" name="ragStatus" value={value} checked={form.ragStatus === value} onChange={() => updateField('ragStatus', value)} />
                <span className="rag-circle" />
                <span>{value[0].toUpperCase() + value.slice(1)}</span>
              </label>
            ))}
          </div>
          <label className="field-label" htmlFor="ragRationale">RAG rationale <span className="required-label">Required</span></label>
          <textarea id="ragRationale" required maxLength={2000} rows={3} value={form.ragRationale} onChange={(event) => updateField('ragRationale', event.target.value)} placeholder="Explain the selected health status…" />
        </div>
        <div className="form-grid">
          {listFields.map(([field, label, placeholder]) => (
            <label className="field-group" key={field}>
              <span className="field-label">{label}</span>
              <textarea rows={3} value={listToLines(form[field])} onChange={(event) => updateField(field, event.target.value)} placeholder={placeholder} />
              <small>Optional. Enter one item per line.</small>
            </label>
          ))}
        </div>
        <div className="form-footer">
          <span className="muted">Each save creates an immutable revision.</span>
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save update'}</button>
        </div>
      </form>
    </>
  );
}

function SourceInputs({ periodEnd, periodStart, onDraftImported, onUploaded }) {
  const [sourceType, setSourceType] = useState('jira');
  const [dataset, setDataset] = useState('issues');
  const [file, setFile] = useState(null);
  const [attested, setAttested] = useState(false);
  const [coverageStart, setCoverageStart] = useState('');
  const [coverageEnd, setCoverageEnd] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const now = new Date();
    setCoverageStart(new Date(now.getTime() - 7 * 86400000).toISOString());
    setCoverageEnd(now.toISOString());
  }, []);

  const datasets = {
    jira: ['issues', 'sprints', 'sprint-scope', 'worklogs', 'issue-links', 'milestones'],
    git: ['commits'],
    confluence: ['pages'],
    capacity: ['allocations'],
    'pm-template': ['weekly-update'],
  };
  const needsAttestation = (sourceType === 'jira' && ['issues', 'milestones'].includes(dataset))
    || (sourceType === 'confluence' && dataset === 'pages');

  function chooseSource(value) {
    setSourceType(value);
    setDataset(datasets[value][0]);
    setResult(null);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) { setError('Choose a CSV file first.'); return; }
    setError('');
    setResult(null);
    setBusy(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('exportedAtUtc', new Date().toISOString());
    formData.append('coverageStartUtc', coverageStart);
    formData.append('coverageEndUtc', coverageEnd);
    formData.append('projectKey', 'USF-PLAN');
    formData.append('clientSharingAttested', String(attested));
    try {
      const response = await request(`/api/v1/source-inputs/${sourceType}/${dataset}`, { method: 'POST', body: formData });
      if (response.draft) {
        setDraft(response.draft);
        onDraftImported(response.draft);
        setResult({ accepted: true, validationSummary: 'PM update draft imported. Review it in the Weekly update screen and save it explicitly.' });
      } else {
        setResult(response);
      }
      setFile(null);
      event.target.reset();
      await onUploaded(response.accepted ? 'CSV was accepted.' : 'CSV validation completed with errors.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="CONTROLLED EXPORTS" title="Source inputs" description="Upload approved CSV exports for the current reporting period. Files are validated before they are used." />
      <div className="notice notice-info">Exports must be UTF-8 CSV and include the source extraction time and coverage period. Maximum file size: 25 MiB.</div>
      <div className="two-column-layout">
        <form className="panel upload-panel" onSubmit={submit}>
          <div className="panel-heading"><div><h2>Upload a source file</h2><p>Only configured project scope is allowed.</p></div><span className="upload-icon">↑</span></div>
          <label className="field-label" htmlFor="source-type">Source</label>
          <select id="source-type" value={sourceType} onChange={(event) => chooseSource(event.target.value)}>
            <option value="jira">Jira</option><option value="git">Git</option><option value="confluence">Confluence</option><option value="capacity">Capacity plan</option><option value="pm-template">PM update template</option>
          </select>
          <label className="field-label" htmlFor="dataset">Dataset</label>
          <select id="dataset" value={dataset} onChange={(event) => setDataset(event.target.value)}>
            {datasets[sourceType].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="field-label" htmlFor="csv-file">CSV file</label>
          <input id="csv-file" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          {file && <small className="file-selected">{file.name} · {(file.size / 1024).toFixed(1)} KB</small>}
          <div className="form-grid compact">
            <label className="field-group"><span className="field-label">Coverage starts (ISO 8601 UTC)</span><input type="text" value={coverageStart} onChange={(event) => setCoverageStart(event.target.value)} placeholder="2026-10-19T13:00:00Z" /></label>
            <label className="field-group"><span className="field-label">Coverage ends (ISO 8601 UTC)</span><input type="text" value={coverageEnd} onChange={(event) => setCoverageEnd(event.target.value)} placeholder="2026-10-26T13:00:00Z" /></label>
          </div>
          {needsAttestation && <label className="checkbox-row"><input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} /><span>I reviewed all <code>client_shareable</code> flags against the applicable client-sharing policy.</span></label>}
          <ErrorNotice error={error} />
          <button className="button button-primary full-width" type="submit" disabled={busy}>{busy ? 'Validating…' : 'Validate and upload'}</button>
          {result && <Notice tone={result.accepted ? 'success' : 'warning'}><strong>{result.accepted ? 'Accepted' : 'Rejected'}.</strong> {result.validationSummary}</Notice>}
          {draft && <Notice tone="info">Imported period {draft.periodEnd}. Open Weekly update to review and save the draft. The import is not saved as canonical narrative.</Notice>}
        </form>
        <aside className="panel contract-panel">
          <h2>Upload checklist</h2>
          <ul className="check-list">
            <li><span>✓</span> Project key is USF-PLAN</li>
            <li><span>✓</span> Include exported-at and coverage timestamps</li>
            <li><span>✓</span> Use the documented dataset columns</li>
            <li><span>✓</span> Keep source scope to approved project areas</li>
          </ul>
          <div className="small-divider" />
          <p className="eyebrow">CURRENT PERIOD</p><strong>{periodStart || '—'} – {periodEnd || '—'}</strong>
          <p className="muted">Uploads record provenance and a validation summary. Raw capacity rows are aggregated in memory and discarded.</p>
          <p className="fine-print">No integrations are connected. This prototype accepts local CSV exports only.</p>
        </aside>
      </div>
    </>
  );
}

function SourceReadiness() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    request('/api/v1/sources')
      .then((response) => { setItems(response.items); setState('ready'); })
      .catch((requestError) => { setError(requestError.message); setState('error'); });
  }, []);

  return (
    <>
      <PageTitle eyebrow="INPUT HEALTH" title="Source readiness" description="Review which approved inputs are current, missing, or not configured." />
      {state === 'loading' && <Loading />}
      {state === 'error' && <ErrorNotice error={error} />}
      {state === 'ready' && (
        <div className="panel table-panel">
          <div className="table-heading"><div><h2>Source status</h2><p>Required Jira datasets gate a full report. Optional sources may be unavailable.</p></div><span className="tiny-badge">CSV IMPORTS</span></div>
          <div className="responsive-table"><table>
            <thead><tr><th>Source / dataset</th><th>Requirement</th><th>Status</th><th>Latest export</th><th>Coverage</th><th>Notes</th></tr></thead>
            <tbody>{items.map((item) => (
              <tr key={`${item.sourceType}/${item.dataset}`}>
                <td><strong>{item.sourceType}</strong><small>{item.dataset}</small></td>
                <td>{item.required ? <span className="pill amber">Required</span> : <span className="muted">Optional</span>}</td>
                <td><span className={`pill ${item.status === 'accepted' ? 'green' : item.status === 'rejected' ? 'red' : 'gray'}`}>{item.status}</span></td>
                <td>{item.exportedAt ? new Date(item.exportedAt).toLocaleString() : '—'}</td>
                <td>{item.coverageStart ? `${new Date(item.coverageStart).toLocaleDateString()} – ${new Date(item.coverageEnd).toLocaleDateString()}` : '—'}</td>
                <td className="notes-cell">{item.warning}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      <Notice>Deployment and release metrics are optional and unavailable until an approved source is identified. No external source scans are performed.</Notice>
    </>
  );
}

function ReportHistory() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [decision, setDecision] = useState('approved');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    setState('loading');
    request('/api/v1/report-runs')
      .then((response) => { setItems(response.items); setState('ready'); })
      .catch((requestError) => { setError(requestError.message); setState('error'); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function review(run) {
    setError('');
    setMessage('');
    try {
      await request(`/api/v1/report-runs/${run.runId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: notes || null }),
      });
      setMessage('Review decision recorded. The report was not distributed.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <PageTitle eyebrow="REPORT REVIEW" title="Report history" description="Inspect generated reports and record your review. Nothing is sent or published." action={<button className="button button-secondary" onClick={load}>Refresh</button>} />
      {error && <ErrorNotice error={error} />}
      {message && <Notice tone="success">{message}</Notice>}
      {state === 'loading' && <Loading />}
      {state === 'error' && <ErrorNotice error={error} />}
      {state === 'ready' && (items.length === 0
        ? <div className="empty-state"><div className="empty-icon">▤</div><h2>No reports yet</h2><p>The scheduled worker has not produced a report. Runs require the weekly PM update and all required Jira inputs.</p><span className="pill gray">Scheduled workflow only · no manual run</span></div>
        : <div className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Reporting period</th><th>Status</th><th>Completed</th><th>Artifact</th><th>Review</th></tr></thead><tbody>{items.map((run) => (
          <tr key={run.runId}>
            <td>{new Date(run.periodStart).toLocaleDateString()} – {new Date(run.periodEnd).toLocaleDateString()}</td>
            <td><span className={`pill ${run.status === 'succeeded' ? 'green' : run.status === 'failed' ? 'red' : 'amber'}`}>{run.status}</span></td>
            <td>{run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}</td>
            <td>{run.artifactAvailable ? <a href={`/api/v1/report-runs/${run.runId}/artifact`}>Download PowerPoint</a> : 'Unavailable'}</td>
            <td>{['succeeded', 'partial'].includes(run.status) ? <button className="button button-small" onClick={() => review(run)}>Record decision</button> : '—'}</td>
          </tr>
        ))}</tbody></table></div>
        <div className="review-controls"><label>Decision <select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="approved">Approved</option><option value="changes_requested">Changes requested</option></select></label><label>Optional note <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} /></label></div>
        </div>
      )}
      <Notice tone="warning">Scheduled report generation is not configured in this build. No report can be run manually, in accordance with the specification.</Notice>
    </>
  );
}

function Settings({ onSaved }) {
  const [settings, setSettings] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request('/api/v1/report-settings')
      .then((response) => { setSettings({ ...response, changeReason: '' }); setState('ready'); })
      .catch((requestError) => { setError(requestError.message); setState('error'); });
  }, []);

  function set(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await request('/api/v1/report-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueStaleBusinessDays: Number(settings.issueStaleBusinessDays),
          inProgressStaleCalendarDays: Number(settings.inProgressStaleCalendarDays),
          sourceFreshnessDays: Number(settings.sourceFreshnessDays),
          statusMapping: settings.statusMapping,
          changeReason: settings.changeReason,
        }),
      });
      setSettings((current) => ({ ...current, version: result.version, changeReason: '' }));
      onSaved('Settings saved as a new version.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (state === 'loading') return <Loading />;
  if (state === 'error') return <ErrorNotice error={error} />;

  return (
    <>
      <PageTitle eyebrow="REPORT POLICY" title="Reporting settings" description="Review and version the thresholds used by scheduled reports. Changes require a reason." />
      <Notice>Settings version {settings.version} is active. Credentials and tokens cannot be configured here.</Notice>
      <ErrorNotice error={error} />
      <form className="panel settings-panel" onSubmit={save}>
        <div className="settings-section"><div><h2>Issue aging</h2><p>Thresholds for stale issue updates and prolonged in-progress work.</p></div>
          <div className="settings-fields">
            <label>Stale issue threshold (business days)<input type="number" min="1" max="100" value={settings.issueStaleBusinessDays} onChange={(event) => set('issueStaleBusinessDays', event.target.value)} /></label>
            <label>In-progress threshold (calendar days)<input type="number" min="1" max="365" value={settings.inProgressStaleCalendarDays} onChange={(event) => set('inProgressStaleCalendarDays', event.target.value)} /></label>
            <label>Source freshness (calendar days)<input type="number" min="1" max="365" value={settings.sourceFreshnessDays} onChange={(event) => set('sourceFreshnessDays', event.target.value)} /></label>
          </div>
        </div>
        <div className="settings-section"><div><h2>Status mapping</h2><p>Current project status categories used to normalize Jira issue states.</p></div>
          <pre className="mapping-preview">{JSON.stringify(settings.statusMapping, null, 2)}</pre>
        </div>
        <div className="settings-section"><div><h2>Scope & forecasts</h2><p>Approved repositories and Confluence project spaces are configured as non-secret allowlists.</p></div>
          <div className="settings-summary"><span>Git repositories <strong>{settings.allowedGitRepositories.length || 'Not configured'}</strong></span><span>Confluence scope <strong>{settings.allowedConfluenceScope.length || 'Not configured'}</strong></span><span>Forecasts <strong>Unavailable in prototype</strong></span></div>
        </div>
        <label className="field-group reason-field"><span className="field-label">Reason for change <span className="required-label">Required</span></span><input value={settings.changeReason} maxLength={500} required onChange={(event) => set('changeReason', event.target.value)} placeholder="Why is this settings version being changed?" /></label>
        <div className="form-footer"><span className="muted">Saving creates an immutable settings version.</span><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save new version'}</button></div>
      </form>
    </>
  );
}
