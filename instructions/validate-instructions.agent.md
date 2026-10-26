- Use Approach 2 — Iterative Rereading: validate one instruction file at a time; reread the current file and only the directly relevant references or comparison files.
- Check Single Responsibility Principle: confirm the file has one cohesive responsibility; flag independent workflows combined in one file.
- Check purpose and workflow clarity: identify one clear purpose and ensure its rules support that purpose.
- Check rule focus and consistency: flag unrelated, vague, conflicting, or unnecessarily repeated rules within the file.
- Check references: verify referenced instruction paths exist and are relevant to the file's responsibility.
- Treat cross-file/shared-rule duplication as supplemental: compare only relevant files available in the current target's context; do not infer duplication. If duplication cannot be verified, include the exact line `Duplication: NOT CHECKED` in Findings.
- Base PASS/FAIL only on checks verifiable from the target file and its directly referenced instructions. PASS requires one clear responsibility, one clear purpose, focused and consistent rules, and valid relevant instruction references; otherwise mark FAIL. Duplication findings do not independently determine PASS/FAIL. Do not treat unverified or invalid instruction references as valid.
- For each file, report:
  + File: workspace-relative path.
  + PASS/FAIL: result of the checks.
  + Primary responsibility: one concise statement.
  + Findings: concise evidence, or `None`.
  + Recommended action: exactly one of `Keep`, `Split`, or `Extract shared rule`, with a brief reason.
- Do not modify the files being validated; report findings and recommendations only.