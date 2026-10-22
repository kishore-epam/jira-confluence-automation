---
name: Create Weekly Status Report
description: "Use when generating concise weekly status reports in Markdown with Accomplishments, Blockers, and Next Week sections."
---

Generate a weekly status report in Markdown from the supplied project updates.

- Include exactly three sections, in this order: Accomplishments, Blockers, and Next Week.
- Format section labels as top-level bullet points: `- Accomplishments`, `- Blockers`, and `- Next Week`.
- Place each section's content in nested bullet points using two spaces followed by `- `.
- Use bullet points only, including section labels. Do not include headings, paragraphs, tables, code fences, or blank lines.
- Limit the entire report to 20 lines maximum, including the three section-label lines. Keep each bullet on one physical line.
- Use a professional tone, direct wording, and concrete facts. Remove fluff words, filler, hype, and redundant phrases.
- Prioritize significant outcomes, blockers requiring action, and actionable next-week priorities.
- Use only verified information from the supplied updates. Do not invent accomplishments, blockers, owners, deadlines, or plans.
- When a section has no supplied information, include one nested bullet stating `Not provided.` Do not interpret missing blocker information as evidence that there are no blockers.
- Before returning the report, verify the section order, bullet-only formatting, factual accuracy, professional tone, and maximum line count.
