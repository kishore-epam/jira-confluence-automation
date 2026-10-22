# Module 10 Completion Report

## Instruction Files
```text
Directory: C:\workspace\hello-genai\instructions

Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a----        22-10-2026     08:48           2204 create-agent-skills.agent.md                                         
-a----        22-10-2026     07:23           1484 create-status-report.agent.md                                        
-a----        22-10-2026     08:50          14420 creating-instructions.agent.md                                       
-a----        22-10-2026     08:48           1838 main.agent.md                                                        
-a----        22-10-2026     08:38           5288 validate-project-source-exports.agent.md                             
```

## main.agent.md Contents
```markdown
# Instructions Catalog

Each entry below is an instruction file with a one-line description. Optional sub-fields:
- **Keywords** — trigger words/phrases: if a user's request matches, load this instruction.
- **Target** — file glob pattern: if the current file or context matches, consider this instruction relevant.
- **Exceptions** — edge cases or clarifications.

---

- [`./creating-instructions.agent.md`](./creating-instructions.agent.md) — Create or update project instructions, catalogs, bootstrap setup, and IDE integrations.
  + Keywords: create an instruction, update an instruction, instruction infrastructure, instruction catalog, Copilot prompt, bootstrap project instructions
- [`./create-agent-skills.agent.md`](./create-agent-skills.agent.md) — Create reusable Agent Skills with scripts, metadata, assets, and catalog integration.
  + Keywords: create a skill, create an agent skill, reusable skill, skill metadata
- [`./create-status-report.agent.md`](./create-status-report.agent.md) — Generate concise weekly status reports in Markdown with Accomplishments, Blockers, and Next Week sections.
  + Keywords: weekly status report, status update, accomplishments, blockers, next week
- [`./validate-project-source-exports.agent.md`](./validate-project-source-exports.agent.md) — Validate user-supplied local Jira or Confluence exports against supplied schemas and rules.
  + Keywords: validate export, Jira export, Confluence export, source freshness, reporting window
  + When to use: Check local project exports before report preparation; do not access live services or modify source files.
  + Required inputs: Local export files and source type; schema, required columns, and value constraints; reporting period and boundary conventions; time zone; freshness threshold and as-of field.
```

## Sample Instruction
- File: create-agent-skills.agent.md
- Contents:
````markdown
# Creating Agent Skills

- Use a skill instead of a plain instruction when the workflow includes executable code, reference documentation, or reusable assets rather than prose steps alone.
- Follow the [Agent Skills format](https://agentskills.io/what-are-skills): create a self-contained skill folder with a required `SKILL.md` and only the optional subfolders needed.
- When creating a skill, generate scripts that retrieve data from the file system and write it to other files during execution. Prefer deterministic scripts for data handling to reduce token use and hallucination risk.
- Create skills under `./instructions/[name]/`, using a verb-first, hyphen-separated name (for example, `run-migration` or `generate-report`).
- Use this structure, omitting any optional folders that are not needed:
  ```
  instructions/[name]/
  ├── SKILL.md          # Required: instructions + metadata
  ├── scripts/          # Optional: executable code (shell, Python, JS, etc.)
  ├── references/       # Optional: documentation, API specs, etc.
  └── assets/           # Optional: templates, example files, resources
  ```
- Include in `SKILL.md`:
  + Frontmatter with at least `name`, `description`, and `version`:
    ```markdown
    ---
    name: skill-name
    description: One-line description of what this skill does
    version: 1.0.0
    ---
    ```
  + Step-by-step instructions in the same bullet-point style as regular instructions.
  + Relative paths for scripts and assets (for example, `./scripts/run.sh`).
- Only create subfolders that are needed; do not scaffold empty `scripts/`, `references/`, or `assets/` directories.
- Add the skill to `./instructions/main.agent.md` as a regular catalog entry linking to `SKILL.md`:
  ```markdown
  - [`./instructions/[name]/SKILL.md`](./[name]/SKILL.md) — one-line description.
    + Keywords: word1, word2
  ```
- In IDE wrappers (VS Code prompts, Cursor rules, or Claude commands), reference `./instructions/[name]/SKILL.md` instead of `[name].agent.md`.
- If a skill grows complex enough to need its own sub-catalog, add `instructions/[name]/main.agent.md` and link it from the root catalog.
````
