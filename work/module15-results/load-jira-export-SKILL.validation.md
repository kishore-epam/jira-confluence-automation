# Instruction Validation

- File: `instructions/load-jira-export/SKILL.md`
- PASS/FAIL: PASS
- Primary responsibility: Load and validate controlled local Jira exports as normalized JSON under the synthetic-test-only profile.
- Findings: No material issues found in verifiable checks. The skill is focused on controlled export loading; its local-tool and contract references support that purpose, and it has no instruction-file references to validate. Duplication: NOT CHECKED
- Recommended action: Keep — the skill has one controlled-export loading responsibility; reassess referenced artifacts and shared-rule duplication when the read scope permits.
