# Role Statement — Supawan Kongsapcharoen (6631503042)

**Role:** Product Owner · JOBAS Company #21 · DPMS

## What I owned

I owned the problem and the product scope, from the first field visit to user acceptance testing.
I started from a real problem at the dormitory front desk: parcels logged in Google Forms and
Sheets, labels with no room number or only a nickname, and residents who could not find their
parcels. I went to the dormitory to collect data with help from teammates. I arranged the
appointments with the five desk Staff and led their group interview, and I recorded how the existing
workflow works. Teammates helped me run the resident questionnaire. I then analysed the results
into concrete pains and decided which ones the product would address. The biggest resident pain (6 of 9) was "the courier
app says delivered, but I can't find it", which is a recording delay rather than a wrong room.
The Staff wanted something fast that still feels like their spreadsheet.

I turned those pains into the Company Charter and the product backlog. Each story traces to an
interview, legal duty or ethics rule, and is prioritised with MoSCoW. I kept the scope to one core
workflow and moved ideas like OCR and resident self-checkout to the scope-creep parking lot. When the
system had to be handed over to a real dormitory, I added the Admin stories for Staff accounts and
the resident CSV import (US-28/US-29), flagged as pending advisor sign-off. Finally, I coordinated
UAT at Baansoi5 Dormitory: five Staff (U01–U05) and five Residents (R01–R05) on 2–5 November 2026.

## Evidence

- Interview and survey analysis: [survey_interview_analysis.md](../../02-design/survey_interview_analysis.md)
- Company Charter: [company_charter.md](../../02-design/company_charter.md) · commits [74d57b7](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/74d57b71608e83ee1dc2260bfa7bfd6ae9ebe52d), [393aafc](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/393aafc8490e274df28a81ed946ed04b3d004f44), [e65f728](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/e65f7280b20b78a869663e49707c5ad0a1ba1cf8)
- Product backlog (MoSCoW, Must Have marked, scope-creep parking lot): [product_backlog.md](../../01-requirements/product_backlog.md)
- Admin tools US-28/US-29: [535bf05](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/535bf056618237eaafdce7e114e9f111e31b8a8a), OWASP review fixes [b4b8a2e](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/b4b8a2e45df0c658bad45e0b1415c78eca9c8462), log [20261101-log.md](../../05-log/20261101-log.md)
- UAT results (SUS, TAM, before/after, session logs): [20261102-uat/README.md](../../03-test/results/20261102-uat/README.md)

## AI disclosure

I used Claude (Claude Code) to organise the interview findings into backlog stories, to draft
documents, and to build and test the Admin tools (US-28/US-29). It also ran an OWASP Top 10
review of that code, which found two issues; both are fixed. Claude is credited as co-author on
those commits. The field work, leading the interviews and the decisions about which problems to
solve are my own. I reviewed and
tested every AI-generated change before it was merged.