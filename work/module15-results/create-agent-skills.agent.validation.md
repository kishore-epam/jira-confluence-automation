# Instruction Validation

- File: `instructions/create-agent-skills.agent.md`
- PASS/FAIL: FAIL
- Primary responsibility: Guide creation and cataloging of self-contained Agent Skills with appropriate metadata, scripts, and optional assets.
- Findings: Failed focused-and-consistent-rules check: the instruction to generate file-reading/writing scripts for every skill conflicts with the later rule that scripts are optional and subfolders should be omitted when unneeded. The `main.agent.md` reference is valid and relevant. Duplication: NOT CHECKED
- Recommended action: Keep — skill structure and packaging form one responsibility; clarify the unconditional script requirement when source edits are authorized.
