---
name: "Calculate Compound Interest"
description: "Use when calculating compound interest, a final investment amount, or interest earned from a principal, annual rate, compounding frequency, and duration."
---

# Calculate Compound Interest

## When to use

Use [compound_interest.py](../tools/compound_interest.py) for fixed-rate compound
interest calculations without deposits, withdrawals, fees, or taxes. Execute the
tool rather than estimating results or reporting an unverified calculation.

## Inputs

Collect these four inputs; ask for any missing or ambiguous values:

| Argument | Meaning | Requirements |
|----------|---------|--------------|
| `principal` | Initial amount | Finite, nonnegative number |
| `annual_rate` | Annual percentage rate | Enter `7.34` for 7.34%, not `0.0734`; finite and nonnegative |
| `compounds_per_year` | Number of compounding periods per year | Positive integer; annually `1`, quarterly `4`, monthly `12` |
| `total_years` | Duration in years | Finite, nonnegative number; fractional years are supported |

Pass numeric arguments without currency signs, percent signs, or thousands
separators. Convert years and months to `years + months / 12`. For example,
8 years and 7 months is approximately `8.583333333333333333333333333333333333333`
years. Preserve sufficient precision during conversion; do not round the
duration to a small number of decimal places.

## Invocation

Run from the workspace root using the configured Python interpreter:

```powershell
python .\tools\compound_interest.py <principal> <annual_rate> <compounds_per_year> <total_years>
```

The arguments are positional and must appear in that order. Replace `python`
with the configured interpreter's executable path if necessary. In PowerShell,
use `&` before a quoted executable path.

Example:

```powershell
python .\tools\compound_interest.py 15847 7.34 12 8.583333333333333333333333333333333333333
```

For usage details:

```powershell
python .\tools\compound_interest.py --help
```

The tool calculates `A = P * (1 + (r / 100) / n) ** (n * t)`, where `r`
is the percentage rate, and interest earned is `A - P`. It uses decimal
arithmetic with 40-digit precision and formats the final results to two
decimal places without intermediate monetary rounding.

## Presenting results

After successful execution:

1. Briefly confirm the principal, annual percentage rate, compounding frequency,
   and duration, including any duration conversion.
2. Report both **Final amount** and **Interest earned**, using the tool's
   output rather than recomputing or changing the rounded values.
3. Format monetary values with thousands separators and two decimal places.
   The tool prints `$`; do not imply currency conversion or relabel the result
   as a different currency without explaining the display convention.
4. Show the formula or invocation if requested.

For the example above:

```text
Final amount: $29,697.95
Interest earned: $13,850.95
```

If the tool exits with an error, report the error explicitly and resolve invalid
inputs before retrying. Do not present example output or estimated values as a
successful result. If execution is unavailable, state that results are unverified.
