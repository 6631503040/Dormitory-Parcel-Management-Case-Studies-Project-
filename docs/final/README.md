# Final submission index — DPMS (JOBAS Company #21)

Dormitory Parcel Management System · live: <https://dormitory-parcel-management-case-studies.onrender.com/>
Every item below is on branch **`main`**. One link per item.

## 1. Discover

| Item | Link |
|---|---|
| Company Charter (members, roles, team rules) | [docs/02-design/company_charter.md](../02-design/company_charter.md) |
| Real-user interviews and pains (10 questionnaire responses + group interview with 5 Staff) | [docs/02-design/survey_interview_analysis.md](../02-design/survey_interview_analysis.md) |
| Lean Canvas (optional) | Not made |
| Requirements and Product Backlog (MoSCoW, Must Have marked) | [docs/01-requirements/product_backlog.md](../01-requirements/product_backlog.md) |
| rule.md — PDPA and legal requirements | [rule.md](../../rule.md) |
| CLAUDE.md — how the team uses AI | [CLAUDE.md](../../CLAUDE.md) |

## 2. Build

| Item | Link |
|---|---|
| Use case diagram | [Use Case Diagram.png](<../02-design/Diagram/Use Case Diagram.png>) |
| Sequence diagrams | [Sequence diagram_1.png](<../02-design/Diagram/Sequence diagram_1.png>) · [Sequence diagram_2.png](<../02-design/Diagram/Sequence diagram_2.png>) |
| ER diagram | [ER Diagram.png](<../02-design/Diagram/ER Diagram.png>) |
| Context diagram | [Context Diagram.png](<../02-design/Diagram/Context Diagram.png>) |
| Architecture | [Architecture Diagram.png](<../02-design/Diagram/Architecture Diagram.png>) |
| Source code — backend (Go/Gin) | [backend/](../../backend/) |
| Source code — frontend (React + Tailwind) | [docs/02-design/prototype/](../02-design/prototype/) |
| Database migrations | [db/migrations/](../../db/migrations/) |
| Own tests — results and test map | [docs/03-test/results/20261102-unit/README.md](../03-test/results/20261102-unit/README.md) |
| README — how to run (setup, `.env.example`, test account) | [README.md](../../README.md) · [docker/.env.example](../../docker/.env.example) |
| No secrets | `.env` files are git-ignored and were never committed ([.gitignore](../../.gitignore)) |

## 3. Test

| Item | Link |
|---|---|
| Test Plan (DPMS-TP-002) | [docs/Test-Plan.docx](../Test-Plan.docx) |
| System test results (TC01–TC64, incl. Flash Sale load test) | [docs/03-test/results/20261028/](../03-test/results/20261028/) |
| UAT session logs (U01–U05, R01–R05, codes only) | [task-records.csv](../03-test/results/20261102-uat/task-records.csv) |
| Before / After for every Must Have task | [UAT results](../03-test/results/20261102-uat/README.md) · [comparison-table.md](comparison-table.md) |
| SUS / TAM responses | [staff-responses.csv](../03-test/results/20261102-uat/staff-responses.csv) · [resident-responses.csv](../03-test/results/20261102-uat/resident-responses.csv) |
| SUS / TAM results and the script that computes them | [UAT results](../03-test/results/20261102-uat/README.md) · [analyze_uat.py](../03-test/results/20261102-uat/analyze_uat.py) |
| Issue log — UAT (severity, fix commit, retest) | [UAT results § Defects](../03-test/results/20261102-uat/README.md#defects-found-issue-log) |
| Issue log — QA and security review (QA-01…07) | [BUGS_AND_SECURITY_TODO_2026-11-01.md](../03-test/BUGS_AND_SECURITY_TODO_2026-11-01.md) |
| Test instruments (UAT dataset, forms) | [docs/03-test/README.md](../03-test/README.md) |

## 4. Deliver

| Item | Link |
|---|---|
| Case study (Problem, Process, Outcome + live URL) | [case-study.md](case-study.md) |
| AI logic (Where, How, Prove, Measure) | [ai-logic.md](ai-logic.md) |
| Comparison table (incl. AI row) | [comparison-table.md](comparison-table.md) |
| Role statement — Supawan Kongsapcharoen (6631503042) | *pending* |
| Role statement — Sadayu Suriya (6631503040) | *pending* |
| Role statement — Kongphop Ruentongdi (6631503103) | *pending* |
| Role statement — Phuriphat Chantiuaong (6631503034) | [6631503034-Phuriphat-Chantiuaong.md](role-statements/6631503034-Phuriphat-Chantiuaong.md) |
| Role statement — Danaiphong Songsikhwa (6631503106) | *pending* |

## 5. Other supporting documents

| Item | Link |
|---|---|
| Design spec (terminology, tokens, screens, data model) | [docs/02-design/design-spec.md](../02-design/design-spec.md) |
| User journeys | [docs/02-design/user_journey.md](../02-design/user_journey.md) |
| Resident notification design (Web Push) | [docs/02-design/web-push-notification.md](../02-design/web-push-notification.md) |
| Repo map | [PROJECT_STRUCTURE.md](../../PROJECT_STRUCTURE.md) |
| Working log | [docs/05-log/](../05-log/) |
| Project proposal | [Proposal_Dormitory-Parcel-Management-System.pdf](../../Proposal_Dormitory-Parcel-Management-System.pdf) |
