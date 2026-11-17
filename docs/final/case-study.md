# Case study — Dormitory Parcel Management System (DPMS)

**Live system:** <https://dormitory-parcel-management-case-studies.onrender.com/>
(Staff desk; Resident page at `/resident/`)
**Team:** JOBAS Company #21 — Supawan Kongsapcharoen (Product Owner), Sadayu Suriya (Tech Lead),
Kongphop Ruentongdi (AI Lead), Phuriphat Chantiuaong (Designer), Danaiphong Songsikhwa (QA)
**Course:** 1305493 Software Engineering Case Studies, 2569 · 26 Aug – 18 Nov 2026

## 1. Problem

The front desk of Baansoi5 Dormitory logs every Parcel with a Google Form into a Google Sheet. It
handles about **418 Parcels in and 418 out per day**, rising to about **1,024 per day in Flash Sale
periods** (desk records 15–20 Aug 2026, [interview analysis](../02-design/survey_interview_analysis.md)).

What we heard from real users — 10 questionnaire responses (9 Residents, 1 part-time Staff member)
and a group interview with 5 regular Staff
([survey_interview_analysis.md](../02-design/survey_interview_analysis.md)):

| Pain | Who | Evidence |
|---|---|---|
| Wrong or missing Room Number: labels have no room, nicknames don't match the official list, handwriting is unreadable, rooms get swapped | Staff | Group interview; [charter](../02-design/company_charter.md) |
| The Sheet becomes slow at peak volume | Staff, Residents ("data updates slowly" 4/9) | Interview, questionnaire |
| Check-Out is one form submission per Parcel, so a Resident with several Parcels waits | Staff | Interview |
| "The courier app says delivered but I can't find it" — the most common Resident problem | Residents 6/9 | Questionnaire |
| Staff fear a new system will be hard; want it to look like what they use now | Staff | Interview |

Constraint from the dormitory: no real Resident data may be used for testing — the team builds
synthetic data.

## 2. Process

- **Agile Scrum**, 2-week sprints, team of 5. Requirements as user stories with MoSCoW priority
  and acceptance criteria in the [product backlog](../01-requirements/product_backlog.md);
  legal requirements (PDPA, Computer Crime Act §26, Electronic Transactions Act) in
  [rule.md](../../rule.md).
- **Scope held to 4 features**: Check-In, Check-Out, Search, Daily Status Dashboard — plus a
  Resident notification page, an audit trail and Admin tools.
- **Design**: locked decisions in [design-spec.md](../02-design/design-spec.md); a UI that mirrors
  the spreadsheet so Staff need little retraining; diagrams in
  [docs/02-design/Diagram/](../02-design/Diagram/) (use case, context, sequence, ER, architecture).
- **Build**: React + Tailwind client → Go/Gin API → PostgreSQL, one Docker image deployed to Render,
  CI on every pull request. AI (Claude Code) was used for requirements, code, tests and reviews,
  with a person reviewing every change — see [ai-logic.md](ai-logic.md).
- **Key decisions**:
  - Room Number is never free text — chosen from the directory and re-checked by the API.
  - **LINE notifications dropped (21 Oct)** for a Web Push Resident page registered with a desk
    OTP ([web-push-notification.md](../02-design/web-push-notification.md)).
  - Label OCR (US-03) deferred to keep scope; its human-confirmation rule is already written (ET-01).
- **Test**: [Test Plan](../Test-Plan.docx) (DPMS-TP-002) → 64 system test cases incl. a Flash
  Sale load test ([results](../03-test/results/20261028/)), 211 unit/integration tests
  ([results](../03-test/results/20261102-unit/README.md)), a QA/security review with regression tests
  ([QA-01…07](../03-test/BUGS_AND_SECURITY_TODO_2026-11-01.md)), then **UAT with 5 Staff and 5
  Residents** ([results](../03-test/results/20261102-uat/README.md)). Two High defects found on the
  first UAT day were fixed the same day (`5da15cc`) and passed on retest.

## 3. Outcome

Full table with sources: [comparison-table.md](comparison-table.md).

| Result | Value | Evidence |
|---|---|---|
| Usability (SUS, 68 = average) | Staff **77.5**, Residents **76.5** (n=5 each) | [UAT results](../03-test/results/20261102-uat/README.md) |
| Acceptance (TAM, 1–5) | Staff **4.46**, Residents **4.54** | same |
| Find who collected a Parcel | 35.8 s → **3.6 s (−90%)** | same |
| Resident sees a Parcel was picked up | 29.0 s → **9.4 s (−68%)** | same |
| Check out a whole room | 47.6 s → **38.8 s (−18%)** | same |
| Wrong Room Number at Check-In | Blocked — only directory rooms accepted | TC06, TC49 in [results.json](../03-test/results/20261028/results.json) |
| Flash Sale day (1,024 in + 1,024 out) | Check-In p95 47 ms, **0 errors, 0 lost records** | TC64, [load-result.txt](../03-test/results/20261028/load-result.txt) |
| System tests | 52 Pass / 3 Fail / 9 Blocked of 64 | [results.json](../03-test/results/20261028/results.json) |

**What did not improve.** Single-Parcel Check-In (23.6 s → 47.4 s), search (5.6 → 9.2 s) and
selective Check-Out (24.8 → 31.8 s) were slower in first use. Staff had months of practice with the
Sheet and minutes with DPMS, and the first two sessions ran on a build with two defects. On the
fixed build no Staff member made an error.

**Not done / open.** Directory page (US-27, API only), room-mismatch check (US-15), label OCR
(US-03); UAT defects UAT-D01 (dialog closes on outside click), UAT-D04 (room number accepted as a
Tracking Code), UAT-D06 (button text size); 3 failing system test cases (TC25, TC35, TC43).

**Next steps.** Fix the open UAT defects, build the Directory page, run a second UAT round after
Staff have used the system for a week to separate learning effects from design problems.
