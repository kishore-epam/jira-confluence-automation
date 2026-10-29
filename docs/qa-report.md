# QA Report — USF-PLAN Weekly Status (local prototype)

| | |
|---|---|
| **Date** | 2026-10-29 |
| **Build under test** | `main` @ `9aed5b8` (pre-fix) → `754205e` (post-fix) |
| **Environment** | Windows 11 · Google Chrome 156.0.8078.48 · Node 24.22.1 · PostgreSQL 15 (Docker Desktop, engine 29.9.2) |
| **Tooling** | Chrome DevTools MCP server (`chrome-devtools-mcp` 1.12.0) driving a real Chrome instance; verification via DOM inspection, Network/Console panels and direct API calls |
| **Scope** | Manual exploratory + flow testing of the React/Vite frontend at `http://127.0.0.1:5173` against the live Express API (`127.0.0.1:3000`) and database |
| **Out of scope** | Scheduled worker / PowerPoint generation (no runnable worker exists yet — known, documented gap), CSV upload flows with real files, Windows Task Scheduler behaviour |

## 1. Summary

| Metric | Result |
|---|---|
| Pages visited | 6 / 6 |
| Main user flow (Weekly update) | **PASS** after fix |
| Bugs found | 1 High, 2 Low |
| Bugs fixed | 1 (the High) |
| Open items | 2 Low (cosmetic / hygiene) |
| JavaScript errors / React warnings | 0 |
| Failed API calls | 0 |
| Backend regression suite | 43 / 43 pass |

**Verdict:** The prototype UI is stable and correctly wired to the API. One high-severity data-entry defect on the primary form was found, fixed, and re-verified in the browser. Remaining findings are cosmetic.

## 2. Environment setup performed

1. Docker Desktop was not running; it was launched and the engine confirmed ready.
2. PostgreSQL started via `scripts/start-local-database.ps1` (credentials from Windows Credential Manager, container reported **healthy**, bound to `127.0.0.1:5432`).
3. Backend started via `scripts/start-local-backend.ps1` — `GET /healthz` → `{"api":"ready","database":"ready"}`.
4. Frontend started with `npm run dev` — HTTP 200, title *USF-PLAN | Weekly status*.
5. Chrome DevTools MCP server added to `.vscode/mcp.json` (`npx -y chrome-devtools-mcp@latest`) and verified by opening the app and taking a screenshot.

## 3. Pages visited and elements inspected

Element inventories were taken from the live accessibility tree, not from screenshots. All pages rendered without layout defects and reflected live backend state.

### Shared shell (every page)
- Logo link → `#dashboard`
- Sidebar nav buttons: Overview · Weekly update · Source inputs (badge **3**) · Source readiness · Report history · Settings
- Breadcrumb `USF-PLAN / <page>`, "Local only" indicator, "PM" avatar, footer "Local workspace / Only this computer"

### 3.1 Overview (`/`)
- H1 *Weekly overview*; H2 *Reporting workflow*
- Buttons: **Refresh**, **Prepare weekly update →**, workflow cards **01 Write the weekly update**, **02 Provide source exports**, **03 Review the report**
- Live `status` regions: missing required Jira inputs; PM update not saved (pre-test); "scheduled workflow only" notice
- KPI cards: *PM update*, *Required Jira inputs 0 / 3*, *Latest report Not Run*
- Reporting period `2026-10-26 – 2026-11-02 (America/New_York)`, deadlines Mon 8:30 / 9:00 ET

### 3.2 Weekly update
- H1 *Project-manager update*; H2 *Overall health*
- Form: radio group Green / Amber / Red (required); textarea **RAG rationale** (required); 5 optional textareas — Accomplishments, Risks & blockers, Decisions needed, Next-week priorities, Milestone changes; button **Save update**
- Footer text "Each save creates an immutable revision."

### 3.3 Source inputs
- H1 *Source inputs*; H2 *Upload a source file*; H2 *Upload checklist*
- Form: select **Source** (Jira / Git / Confluence / Capacity plan / PM update template); select **Dataset** (issues / sprints / sprint-scope / worklogs / issue-links / milestones); file input **CSV file**; text inputs **Coverage starts / ends (ISO 8601 UTC)**; checkbox `client_shareable` attestation; button **Validate and upload**
- Checklist (4 items), current-period panel, "No integrations are connected" notice

### 3.4 Source readiness
- H1 *Source readiness*; H2 *Source status*
- Read-only table, 10 rows (3 Required Jira datasets = *missing*; 6 Optional = *missing*; deployment/releases = *unavailable*)
- `status` region about deployment metrics; no interactive controls

### 3.5 Report history
- H1 *Report history*; H2 *No reports yet* (empty state)
- Button **Refresh**; chip "Scheduled workflow only · no manual run"
- `status` region: scheduled generation not configured in this build

### 3.6 Settings
- H1 *Reporting settings*; H2 *Issue aging*, *Status mapping*, *Scope & forecasts*
- Form: number inputs **Stale issue threshold** (5, 1–100), **In-progress threshold** (10, 1–365), **Source freshness** (7, 1–365); read-only status-mapping JSON; Git repositories / Confluence scope *Not configured*; Forecasts *Unavailable in prototype*; text input **Reason for change** (required); button **Save new version**
- `status` region: "Settings version 1 is active. Credentials and tokens cannot be configured here."

## 4. Main user flow test — Weekly update (dashboard step 01)

| # | Step | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | Load `/` | Dashboard, PM update *Not Started*, step 01 *Action needed* | As expected | PASS |
| 2 | Click **Prepare weekly update** | Routes to Weekly update form | As expected | PASS |
| 3 | Click **Save update** with empty rationale | Submit blocked, field-level validation | Assertive alert "Please fill out this field.", focus moved to RAG rationale, **no network call** | PASS |
| 4 | Select **Amber**, type RAG rationale (135 chars) | Values retained | Retained; survived radio toggles (forced re-render) | PASS |
| 5 | Type into optional textareas (Accomplishments etc.) | Text visible and retained | **Every keystroke erased** — see BUG-1 | **FAIL** (pre-fix) |
| 6 | Click **Save update** | Button disabled "Saving…", `PUT` 201, toast, dashboard refresh | `PUT /api/v1/project-updates/2026-11-02` → **201** `{revision:1}`; dashboard re-fetched (200); toast "Weekly update saved." wired (3.5 s) | PASS |
| 7 | Verify dashboard | PM update *Ready / Revision 1*, step 01 *Complete*, warning cleared | As expected | PASS |
| 8 | `GET /api/v1/project-updates?periodEnd=2026-11-02` | `complete: true`, saved values | As expected (but `accomplishments: ["X"]` — corrupted by BUG-1) | PASS (API) / defect noted |
| 9 | Re-open form | Saved values load | All fields populated from server | PASS |
| 10 | **Post-fix re-run of step 5–6** | Typed multi-line text visible, retained across re-render, saved | Two-line Accomplishments retained; `PUT` → **201** `{revision:2}` with correct arrays | **PASS** |

## 5. Bugs found

### BUG-1 — Optional narrative fields erase every keystroke (High) — **FIXED**

| | |
|---|---|
| **Severity** | High — silent data corruption on the primary form |
| **Location** | `frontend/src/App.jsx`, `listToLines()` used by the five optional textareas in `WeeklyUpdate` |
| **Symptom** | Typing into Accomplishments, Risks & blockers, Decisions needed, Next-week priorities or Milestone changes shows nothing; the box stays empty. |
| **Root cause** | `listToLines(value)` returned `''` for any non-array. `onChange` stores the typed value as a **string**, so the controlled `value={listToLines(form[field])}` re-rendered as `''` after each keystroke. The required `ragRationale` field does not use the helper, which is why it worked. |
| **Impact** | Worse than "field does not work": the string *was* in state and *was* submitted. Because the box always displayed empty, each keystroke replaced the whole value — typing `Hello` would save `["o"]`. Revision 1 in the test DB contains `accomplishments: ["X"]` (a single probe keystroke) as evidence. Values loaded back from the API (arrays) displayed correctly, so the defect only affected data entry. |
| **Reproduction** | Weekly update → click Accomplishments → type `X` → DOM value is `""` (confirmed via `document.activeElement.value`). |
| **Fix** | `listToLines` now passes strings through:<br>`if (Array.isArray(value)) return value.join('\n');`<br>`return typeof value === 'string' ? value : '';`<br>`save()` already converts strings back to lists, so no other change was needed. |
| **Commit** | `754205e` — *fix: form validation error on submit* |
| **Verification** | `vite build` passes; real keystrokes into Accomplishments retained (single and multi-line); values survived a RAG radio toggle; end-to-end save produced revision 2 with the correct arrays; backend suite 43/43. |

### BUG-2 — Form fields lack `id`/`name` attributes (Low) — **OPEN**

| | |
|---|---|
| **Severity** | Low — a11y/autofill hygiene; surfaces in Chrome's Issues panel ("A form field element should have an id or name attribute") |
| **Affected fields (12)** | Weekly update: 5 optional textareas · Source inputs: Coverage starts, Coverage ends, attestation checkbox · Settings: 3 threshold inputs, Reason for change |
| **Impact** | Labels wrap the controls, so screen readers announce them correctly; only browser autofill heuristics and DevTools lint are affected. |
| **Suggested fix** | Add a `name` (and/or `id`) attribute to each control. |

### BUG-3 — Missing favicon (Low, cosmetic) — **OPEN**

| | |
|---|---|
| **Severity** | Low — cosmetic |
| **Symptom** | `GET /favicon.ico` → 404, logged as a console error on every page load. The only non-2xx/304 request out of 77 observed. |
| **Suggested fix** | Add `frontend/public/favicon.ico` (or a `<link rel="icon">` to an SVG) |

## 6. Console and network audit

Swept across all six pages (single-URL SPA, so one log covers all views).

- **JavaScript errors:** none
- **React warnings** (keys, controlled/uncontrolled, act, prop types): none
- **Unhandled promise rejections / CORS / CSP:** none
- **Console entries present:** Vite HMR debug (`connecting / connected / hot updated: /src/App.jsx`), React DevTools info banner, favicon 404 (BUG-3), form-field `id/name` issue (BUG-2)
- **Network:** 77 requests observed; all API calls 200/201/304; two successful `PUT /api/v1/project-updates/2026-11-02` (revisions 1 and 2)

## 7. Observations (not defects)

- Navigation is button-driven and never changes the URL; browser back/forward and deep links to a section are not supported. Only the logo links to `#dashboard`.
- Required fields are correctly exposed as `required` in the accessibility tree; alerts use `aria-live` status regions.
- Report history's empty-state copy ("Scheduled report generation is not configured in this build") honestly reflects the known missing-worker gap.
- **Test-automation note:** the DevTools MCP `fill` / `fill_form` tools set `.value` without dispatching `input` events, so React controlled inputs do not register them, and snapshot UIDs go stale after every React re-render. Reliable pattern: re-snapshot → `click` → `type_text` (real keystrokes) → verify via `evaluate_script`. Several early "failures" in this session were tool artifacts and were distinguished from BUG-1 by that method.

## 8. Current status

| Item | State |
|---|---|
| BUG-1 (High) | Fixed in `754205e`, verified in browser and via API |
| BUG-2 (Low) | Open — 12 fields need `name`/`id` |
| BUG-3 (Low) | Open — add favicon |
| Backend regression | 43 / 43 passing |
| Frontend tests | None exist; no runner configured (consider Vitest + Testing Library to cover `listToLines` / `WeeklyUpdate`) |
| Test data left in local DB | Period `2026-11-02`: revision 1 (`accomplishments: ["X"]`, pre-fix) and revision 2 (correct, post-fix). Revisions are immutable by design; revision 2 is current. |
| Services | PostgreSQL container, backend (`:3000`) and Vite (`:5173`) left running; Chrome test window open |

## 9. Recommended next steps

1. Add `name` attributes to the 12 flagged inputs and a favicon (both trivial).
2. Introduce a minimal frontend test setup and add a regression test for BUG-1 (type into an optional field → value visible → submit payload is a list).
3. Extend browser testing to the CSV upload path with fixture files, and to Settings "Save new version".
4. Once the scheduled worker exists, repeat this pass to cover Report history / artifact retrieval / review.
