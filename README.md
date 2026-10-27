# USF-PLAN Weekly Status Prototype

The local prototype uses PostgreSQL 15, an Express API, and a React/Vite UI. It is
loopback-only and accepts controlled CSV exports; it does not connect to Jira or
Confluence directly, email reports, or provide a manual report-generation action.

## Local API and database startup (Windows)

Register the API/database startup task for the dedicated signed-in account.
Preview first; `-WhatIf` does not register or change a Windows task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-local-startup-task.ps1 -WhatIf
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-local-startup-task.ps1
```

At user logon, the task runs `start-local-services-on-logon.ps1`, which starts
Docker Compose PostgreSQL using Windows Credential Manager and then starts the
Express API using its local credential wrapper. Start Docker Desktop before
signing in. The Vite UI remains on demand:

```powershell
npm --prefix frontend run dev
```

Open <http://127.0.0.1:5173>. The API health check is
<http://127.0.0.1:3000/healthz>.

The backend startup wrapper applies local ACLs to `data\inputs`, `data\reports`,
and `data\logs`. Keep all services on this machine; do not bind them to a LAN
interface.

## Windows scheduled worker

The Windows time zone must be **Eastern Standard Time (US & Canada)** before
registering the worker task. Its daylight-saving rules align the weekly 09:00
trigger with `America/New_York`; registration refuses to create the task under a
different local time zone. The task runs interactively as the signed-in project
manager and does not start when an occurrence was missed.

Preview before registering:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-local-worker-task.ps1 -WhatIf
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-local-worker-task.ps1
```

The worker wrapper derives the scheduled occurrence's UTC trigger and local
period-end date, then passes both to the report worker so an allowed retry can
retain the original anchor. It retrieves the worker token from the
`USF-PLAN/WorkerToken` Credential Manager entry without placing it on the command
line.

The runnable `scripts\report-worker.py` workflow and period-scoped Jira input
snapshot are not implemented. The wrapper fails safely rather than reporting
success when that worker is absent. Worker/report integration is blocked on
T-028; the schedule and local startup orchestration do not complete reports.

## Current prototype boundary

The UI supports saving PM update revisions, reviewing source readiness,
submitting CSVs for contract validation, versioning basic reporting thresholds,
and inspecting report history. Windows startup and scheduled-task orchestration
are available, but report-worker integration remains incomplete. The UI
intentionally does not offer a manual “run now” operation.
