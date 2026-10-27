# USF-PLAN Weekly Status Prototype

The local prototype uses PostgreSQL 15, an Express API, and a React/Vite UI. It is
loopback-only and accepts controlled CSV exports; it does not connect to Jira or
Confluence directly, email reports, or provide a manual report-generation action.

## Start the local application (Windows)

1. Start Docker Desktop.
2. From the repository root, start the database using the approved Credential
   Manager entry:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-database.ps1
   ```

3. In a separate PowerShell terminal, start the API. The wrapper reads the
   PostgreSQL credential without placing it in a command line or log:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-backend.ps1
   ```

4. In a third terminal, start the Vite UI:

   ```powershell
   npm --prefix frontend run dev
   ```

5. Open <http://127.0.0.1:5173>. The API health check is
   <http://127.0.0.1:3000/healthz>.

The backend startup wrapper applies local ACLs to `data\inputs`, `data\reports`,
and `data\logs`. Keep all three services on this machine; do not bind them to a
LAN interface.

## Windows scheduled worker

Use the Task Scheduler wrapper to install the weekly report worker in the
project-manager session:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-local-worker-task.ps1 -WhatIf
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-local-worker-task.ps1
```

The task runs every Monday at 09:00 in `America/New_York`, without replaying
missed triggers. The task reads the worker secret from the `USF-PLAN/WorkerToken`
Credential Manager entry and fails safely if Docker, the loopback API, or the
required Python/runtime prerequisites are unavailable.

## Current prototype boundary

The UI supports saving PM update revisions, reviewing source readiness,
submitting CSVs for contract validation, versioning basic reporting thresholds,
and inspecting report history. The scheduled worker is now registered through the
Windows Task Scheduler wrapper, but the Python report-generation implementation
remains a separate runtime dependency. The UI intentionally does not offer a
manual “run now” operation.
