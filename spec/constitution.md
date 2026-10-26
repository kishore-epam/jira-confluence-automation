# Project Constitution

## Purpose

This project automates preparation of a concise weekly USF-PLAN status report for project leadership, the client/sponsor, and delivery leads. The Module 08 specification in `work/module03-task/project_spec.md` is the source of product requirements. This constitution establishes project-wide principles for implementing and operating that product.

## Core Principles

### 1. Requirements and reporting integrity

- Implement the reporting measures, reporting window, audience, and acceptance criteria in the Module 08 specification.
- Keep weekly planned capacity separate from Jira issue estimates.
- Show the basis and confidence for forecasts; when the available history is insufficient, mark forecasts unavailable rather than inventing or implying certainty.
- Identify unavailable, stale, or partial source data in the report. Never silently substitute stale values.
- Treat unresolved product and integration choices in the specification as explicit decisions; do not invent production endpoints, mappings, or conventions.

### 2. Approved technology stack

- Frontend: React 18 with Vite.
- Application backend: Node.js with Express.
- Database: PostgreSQL 15, run through Docker for the containerized development/runtime environment.
- Keep responsibilities and interfaces between frontend, backend, database, and reporting execution explicit.
- The Module 08 specification also requires Python report generation and a Windows Scheduled Task. Preserve these requirements: do not silently replace the report worker or its schedule with Node.js. Define its integration with the web application during feature planning, keeping report generation and scheduled execution reliable.
- Any change to these technology or runtime requirements must be documented and approved before implementation.

### 3. Security and least privilege

- Use read-only integration access to Jira, Git hosting, Confluence, and other source systems unless a separately approved requirement says otherwise.
- Never commit credentials, access tokens, private keys, or other secrets. Use an organization-approved secret store and keep secrets out of logs, reports, and database fixtures.
- Request only the access needed for the configured project, repositories, and Confluence locations. Do not scan the entire Confluence site by default.
- Validate and constrain external input, including API data and controlled CSV/XLSX exports.
- Restrict access to source inputs and generated reports according to organizational policy.

### 4. Privacy and client-safe output

- Represent the 36-person delivery group as one combined group in client-facing output.
- Report aggregate capacity only. Do not disclose named planned or actual hours until explicit organizational approval is recorded.
- Include Jira issue keys and titles only within the sharing scope approved in the Module 08 specification, while maintaining normal source-system access controls.
- Exclude unnecessary personal data from logs, storage, and reports.

### 5. Human approval and controlled delivery

- Generate reports for project-manager review; do not automatically email, publish, or distribute them.
- Require project-manager approval before any manual external distribution.
- Keep deployment/release metrics optional and clearly unavailable until an approved source is configured.

### 6. Reliability and data handling

- Validate required inputs, configuration, access, and reporting-window boundaries before processing.
- Use the preceding seven days in `America/New_York` and include the active fixed Scrum sprint, as defined by the specification.
- Fail with actionable errors for invalid required inputs or invalid reporting windows.
- Allow partial reports only when unavailable or stale sources are clearly identified.
- On a failed generation, preserve the previous successful report. On success, save both a dated report and an updated `latest` copy; retain dated reports for one year.
- Keep configuration separate from code, validate it at startup, and provide safe non-secret defaults only where the specification allows them.

### 7. Testing and maintainability

- Test requirements and observable behavior, including calculations, date boundaries and time zones, stale/missing-source handling, privacy constraints, and output preservation on failure.
- Keep frontend, API, persistence, integrations, and report generation independently testable through explicit contracts.
- Prefer clear, small components and documented interfaces over duplicated business rules.
- Include tests for security-sensitive behavior and client-facing data redaction.

### 8. Operational transparency

- Record execution time, source success or failure, report period, and output location.
- Do not log secrets or unnecessary personal data.
- Make data freshness, missing inputs, and forecast limitations visible to the project manager and report recipients.
- Run on the specified Windows Scheduled Task schedule: Mondays at 9:00 a.m. `America/New_York`, with PM input due by 8:30 a.m. Eastern.

## Change Control

Requirements, architecture, access scope, privacy rules, or operating schedules that conflict with this constitution or the Module 08 specification must be raised and resolved before implementation. Record approved decisions in the relevant specification or plan so implementation and verification use the same source of truth.
