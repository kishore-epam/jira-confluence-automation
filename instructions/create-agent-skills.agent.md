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
