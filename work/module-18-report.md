# Module 18 Completion Report

## Target Application
- URL: http://127.0.0.1:5173 (USF-PLAN Weekly status — React/Vite frontend, backed by the Express API at http://127.0.0.1:3000)

## QA Findings
| # | Category | Finding | Severity | MCP Tool Used |
|---|----------|---------|----------|---------------|
| 1 | Functional / data entry | On the Weekly update form, the five optional textareas (Accomplishments, Risks & blockers, Decisions needed, Next-week priorities, Milestone changes) erased every keystroke: typing `X` into the focused Accomplishments field left the DOM value `""`, yet the typed string was still submitted (`PUT /api/v1/project-updates/2026-11-02` body contained `"accomplishments":["X"]`). Root cause: `listToLines()` in `frontend/src/App.jsx` returned `''` for string state. Fixed in commit `754205e` and re-verified. | High | evaluate_script |
| 2 | Accessibility / form hygiene | Chrome issue "A form field element should have an id or name attribute" raised for 12 controls: 5 optional textareas (Weekly update), Coverage starts / Coverage ends / attestation checkbox (Source inputs), 3 threshold inputs and Reason for change (Settings). | Low | list_console_messages |
| 3 | Network / resources | `GET /favicon.ico` returns 404 on every page load and is logged as a console error; it was the only non-2xx/304 request among 77 observed. | Low | list_network_requests |
| 4 | Navigation / UX | All six sections are reached via sidebar `button` elements; the page URL stayed at `http://127.0.0.1:5173/` on every section, so browser back/forward and deep links to a section are not supported. | Low | take_snapshot |

## MCP Tools Used
- new_page
- navigate_page
- take_screenshot
- take_snapshot
- click
- fill
- fill_form
- type_text
- press_key
- evaluate_script
- list_console_messages
- get_console_message
- list_network_requests
- get_network_request
- wait_for
