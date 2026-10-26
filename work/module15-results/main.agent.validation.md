# Instruction Validation

- File: `instructions/main.agent.md`
- PASS/FAIL: FAIL
- Primary responsibility: Route users to relevant project instructions through concise descriptions and keywords.
- Findings: `creating-instructions.agent.md` defines `main.agent.md` as the catalog of all instructions, but this catalog omits `validate-instructions.agent.md`, `calculate-compound-interest.agent.md`, and the three `use-*` instruction files. Its seven listed references exist and their descriptions match the referenced responsibilities. Duplication: NOT CHECKED
- Recommended action: Keep — the catalog has a focused routing responsibility; address catalog coverage separately and reassess shared-rule duplication when cross-file comparison is permitted.
