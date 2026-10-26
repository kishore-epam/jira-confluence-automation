# Instruction Validation

- File: `instructions/calculate-compound-interest.agent.md`
- PASS/FAIL: PASS
- Primary responsibility: Calculate and present fixed-rate compound-interest results by invoking the local Python calculator with validated inputs.
- Findings: No material issues found in verifiable checks. Input validation, invocation, and result presentation support one focused calculation workflow. The local calculator reference supports that purpose; there are no instruction-file references. Duplication: NOT CHECKED
- Recommended action: Keep — the file has one clear calculator responsibility; reassess shared-rule duplication when cross-file comparison is permitted.
