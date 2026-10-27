CREATE TABLE IF NOT EXISTS projects (
    project_id BIGSERIAL PRIMARY KEY,
    project_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reporting_settings (
    settings_version_id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(project_id),
    issue_stale_business_days INTEGER NOT NULL CHECK (issue_stale_business_days BETWEEN 1 AND 100),
    in_progress_stale_calendar_days INTEGER NOT NULL CHECK (in_progress_stale_calendar_days BETWEEN 1 AND 365),
    source_freshness_days INTEGER NOT NULL CHECK (source_freshness_days BETWEEN 1 AND 365),
    status_mapping JSONB NOT NULL,
    allowed_git_repositories TEXT[] NOT NULL DEFAULT '{}',
    allowed_confluence_scope TEXT[] NOT NULL DEFAULT '{}',
    change_reason TEXT NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_updates (
    project_update_id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(project_id),
    period_end DATE NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    rag_status TEXT NOT NULL CHECK (rag_status IN ('red', 'amber', 'green')),
    rag_rationale TEXT NOT NULL CHECK (length(rag_rationale) BETWEEN 1 AND 2000),
    accomplishments JSONB NOT NULL,
    risks_and_blockers JSONB NOT NULL,
    decisions_needed JSONB NOT NULL,
    next_week_priorities JSONB NOT NULL,
    milestone_changes JSONB NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, period_end, revision)
);

CREATE INDEX IF NOT EXISTS project_updates_period_idx
    ON project_updates (project_id, period_end, revision DESC);

CREATE TABLE IF NOT EXISTS source_inputs (
    source_input_id UUID PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(project_id),
    period_end DATE NOT NULL,
    source_type TEXT NOT NULL,
    dataset TEXT NOT NULL,
    storage_key TEXT,
    content_hash TEXT NOT NULL,
    exported_at TIMESTAMPTZ NOT NULL,
    coverage_start TIMESTAMPTZ NOT NULL,
    coverage_end TIMESTAMPTZ NOT NULL,
    validation_status TEXT NOT NULL,
    validation_summary TEXT NOT NULL,
    client_sharing_attested_at TIMESTAMPTZ,
    retention_until TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    supersedes_source_input_id UUID REFERENCES source_inputs(source_input_id)
);

ALTER TABLE source_inputs
    DROP CONSTRAINT IF EXISTS source_inputs_validation_status_check;

ALTER TABLE source_inputs
    ADD CONSTRAINT source_inputs_validation_status_check
    CHECK (validation_status IN ('accepted', 'rejected', 'stale', 'incomplete'));

CREATE INDEX IF NOT EXISTS source_inputs_period_idx
    ON source_inputs (project_id, period_end, source_type, dataset, received_at DESC);

CREATE TABLE IF NOT EXISTS capacity_aggregates (
    project_id BIGINT NOT NULL REFERENCES projects(project_id),
    week_start DATE NOT NULL,
    planned_hours_total NUMERIC(10, 1) NOT NULL CHECK (planned_hours_total >= 0),
    source_input_id UUID NOT NULL REFERENCES source_inputs(source_input_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, week_start)
);

CREATE TABLE IF NOT EXISTS report_runs (
    report_run_id UUID PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(project_id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed')),
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    failure_code TEXT,
    failure_summary TEXT,
    project_update_id BIGINT REFERENCES project_updates(project_update_id),
    settings_version_id BIGINT REFERENCES reporting_settings(settings_version_id),
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
    retry_of_report_run_id UUID REFERENCES report_runs(report_run_id),
    worker_version TEXT,
    previous_success_preserved BOOLEAN NOT NULL DEFAULT TRUE,
    lease_expires_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    artifact_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS latest_report_run_id UUID REFERENCES report_runs(report_run_id);

CREATE TABLE IF NOT EXISTS report_run_inputs (
    report_run_id UUID NOT NULL REFERENCES report_runs(report_run_id),
    source_input_id UUID NOT NULL,
    input_role TEXT NOT NULL CHECK (input_role IN ('source', 'artifact')),
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (report_run_id, source_input_id)
);

CREATE TABLE IF NOT EXISTS report_reviews (
    review_id BIGSERIAL PRIMARY KEY,
    report_run_id UUID NOT NULL REFERENCES report_runs(report_run_id),
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
    notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
    actor_label TEXT NOT NULL DEFAULT 'Local project manager',
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO projects (project_key, name)
VALUES ('USF-PLAN', 'USF-PLAN')
ON CONFLICT (project_key) DO NOTHING;

INSERT INTO reporting_settings (
    project_id,
    issue_stale_business_days,
    in_progress_stale_calendar_days,
    source_freshness_days,
    status_mapping,
    change_reason
)
SELECT project_id, 5, 10, 7,
       '{"To Do":"todo","In Progress":"in_progress","Done":"done"}'::jsonb,
       'Initial prototype defaults'
FROM projects
WHERE project_key = 'USF-PLAN'
AND NOT EXISTS (
    SELECT 1 FROM reporting_settings WHERE project_id = projects.project_id
);
