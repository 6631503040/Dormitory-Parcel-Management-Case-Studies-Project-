# AI logic — where AI is used, how, how we prove it, how we measure it

**Owner:** Kongphop Ruentongdi (6631503103), AI Lead. Every claim below links to a file or a
command in this repo, except the three statements listed under
[Confirmed by the AI Lead](#confirmed-by-the-ai-lead).

## Summary

**DPMS has no AI feature in the product.** Check-In, Check-Out, search and the dashboard are
rule-based: the Room Number is chosen from the Resident directory, search is plain-text matching,
and nothing is predicted or ranked. The only planned AI feature, reading the label with OCR and
suggesting a room (US-03), is *Should Have*. We did not build it, to keep the scope to the four core
features. We used AI **to build the system**: requirements, code, tests and reviews. A team member
reviewed every AI-assisted change before it was merged.

## 1. Where

| Area | AI used? | What |
|---|---|---|
| Product: Check-In / Check-Out / search / dashboard | **No** | Rule-based. The API validates the Room Number against the directory (`422 ROOM_NOT_IN_DIRECTORY`). |
| Product: label OCR / room suggestion (US-03) | **No, not built** | Deferred. Its safeguards are already in the backlog (see section 4). |
| Requirements | Yes | The `requirement-writer` and `backlog-auditor` agents and the `/capture-requirement` and `/audit-backlog` skills drafted and checked backlog entries. |
| Design | Yes | The `design-spec` skill produced the locked decisions in `docs/02-design/design-spec.md`. The Impeccable skill critiqued the UI (see the Designer's role statement). |
| Code | Yes | Claude Code with the `backend-go`, `frontend-react`, `db-postgres` and `devops-docker` agents. GitHub Copilot's agent made 1 commit. |
| Tests and test data | Yes | The `qa-tester` agent drafted unit and integration tests and the load test. The `data-seeder` agent drafted the synthetic directory and Parcels (`backend/cmd/seed`). We did not record which test file came from which agent, so section 5 measures AI use per commit instead. |
| Reviews | Yes | The `code-review` and `security-audit` skills, and the QA/security review of 1 Nov (QA-01…QA-07). The fixes were made with Claude (commit `b0a35e6`). We did not record whether each finding came from an AI skill or from a person. QA-01 and QA-02 were already listed as known gaps in `backend/README.md` before the review. |
| UAT analysis | Yes | `analyze_uat.py`, written with Claude, recomputes SUS/TAM and task times from the raw workbook. |

AI setup for the project:

- `CLAUDE.md`: rules every agent must follow (scope, terminology, the non-negotiable constraints).
- `.claude/agents/`: 8 specialist agents. `.codex/agents/` holds the same 8 for Codex, with `AGENTS.md`.
- `.claude/skills/`: 7 skills.

## 2. How

1. **Rules first.** `CLAUDE.md` fixes the scope (4 features), the stack, and the constraints AI
   output must not break: the Room Number is never free text, the audit trail is append-only, RBAC
   is enforced in the API, and the PDPA rules in `rule.md` apply.
2. **One specialist agent per area.** Each agent in `.claude/agents/` carries the rules for its own
   area, so its output stays inside scope.
3. **A person owns every change.** AI output goes into a branch and a pull request, and a team
   member reviews and merges it. Pull requests have been the workflow since 4 Sep 2026; only 4
   non-merge commits went to `main` directly. Commits made with Claude carry a
   `Co-Authored-By: Claude` trailer, so AI-assisted work can be traced.
4. **Tests gate every change since 1 Nov 2026.** From that date, CI (GitHub Actions,
   `.github/workflows/ci.yml`, added in `3fbbc71`) runs the Go and Vitest suites on every pull
   request. Render deploys only after CI passes. Before 1 Nov, the author ran the tests locally.

## 3. Prove: test set, baseline, evaluation

The AI wrote code; it is not a model inside the product. So to prove it works, we show that
AI-assisted code passes the same tests as any other code, and that AI-assisted fixes really fixed
the defect.

| What | Test set | Baseline (before) | Result (after) | Evidence |
|---|---|---|---|---|
| AI-assisted code is correct | 159 Vitest tests + 52 Go tests (integration against a real PostgreSQL, 0 skipped) | — | **211 / 211 pass** on build `9344cff` | [unit results](../03-test/results/20261102-unit/README.md) |
| AI-assisted fixes of the 1 Nov QA review (commit `b0a35e6`, Claude co-authored) | QA-01…QA-05: regression tests in `qa_review_test.go`, `Modals.CheckOut.test.jsx`, `errorMessages.test.js`. QA-06, QA-07: dependency scans (`npm audit`, `govulncheck`) | Each test **fails** on the code before the fix (e.g. a copied cookie still works after logout → `200`). Scans: `npm audit` 10 packages, `govulncheck` 18 advisories with a call trace | Each test **passes** after the fix (→ `401`). Scans: `npm audit` 0, `govulncheck` 0 called advisories | [BUGS_AND_SECURITY_TODO](../03-test/BUGS_AND_SECURITY_TODO_2026-11-01.md) |
| AI-assisted UAT fix (commit `5da15cc`, Claude co-authored) | UAT tasks UAT04–UAT06 with real Staff | U01, U02 on the old build: 4 errors, UAT06 Fail (UAT-D03, UAT-D05) | U03–U05 on the fixed build: 0 errors, UAT06 Pass | [UAT results](../03-test/results/20261102-uat/README.md) |
| System as a whole | 64 system test cases (TC01–TC64) on synthetic data | — | 52 Pass / 3 Fail / 9 Blocked (rounds 1–2). After the fixes made with Claude, round 3 (18 Nov): **55 Pass / 0 Fail / 9 Blocked**, [round 3](../03-test/results/20261118-retest/README.md) | [results.json](../03-test/results/20261028/results.json) · [fix results](../03-test/results/20261118-fix/README.md) |
| UAT numbers are computed correctly | `analyze_uat.py` recomputes SUS/TAM without using the spreadsheet formulas | Spreadsheet formulas | Same values for all 10 participants | [analyze_uat.py](../03-test/results/20261102-uat/analyze_uat.py), [summary.txt](../03-test/results/20261102-uat/summary.txt) |

Limits of this proof:

- Passing tests show that the code does what the tests check. They do not show that the tests are
  complete. `results.json` lists the 3 failing (fixed 18 Nov, Pass in round 3) and 9 blocked system test cases.
- QA-05 was tested with Vitest only. We did not repeat it in Playwright on Chromium or with a real
  barcode scanner.
- The UAT comparison uses different participants before and after the fix (2 and 3 people). It
  points to an improvement but does not prove one.
- We have **no baseline for development speed without AI**, because we did not build any feature
  twice. We make no claim that AI made the team faster.

## 4. Safeguards for a future AI feature (already in the backlog)

- **ET-01 Human confirmation:** an OCR read or a room suggestion is saved only after Staff accept,
  edit or reject it. There is no "auto-apply above X% confidence".
- **ET-04 Graceful degradation:** if OCR is down, Check-In falls back to manual entry (US-02).
- The API validates every Room Number against the directory, whether it was typed or suggested.

Source: [product_backlog.md](../01-requirements/product_backlog.md), epic E6.

## 5. Measure

Counts are taken at commit `12ebe3a` (17 Nov 2026, the last code-and-test commit before the final
documents), so they can be reproduced exactly.

| Measure | Value | How to reproduce |
|---|---|---|
| Non-merge commits with a `Co-Authored-By: Claude` trailer | **13 of 52** (25%), 26 Aug – 17 Nov 2026 | `git log 12ebe3a --no-merges -i --grep="Co-Authored-By: Claude" --oneline \| wc -l` and `git log 12ebe3a --no-merges --oneline \| wc -l` |
| Commits by GitHub Copilot's agent | 1 | `git log 12ebe3a --no-merges --author=copilot --oneline` |
| AI-assisted fixes verified before → after | 7 (QA-01…QA-07): 5 by regression test, 2 by dependency scan | [BUGS_AND_SECURITY_TODO](../03-test/BUGS_AND_SECURITY_TODO_2026-11-01.md) |
| Agents and skills set up for the project | 8 agents, 7 skills | `ls .claude/agents .claude/skills` |
| Accuracy of an AI feature in the product | **N/A**, because the product has no AI feature | — |

The trailer count is a lower bound. AI-assisted work committed without the trailer is not counted.
For example, the first Web Push version (commit `29b69fe`, 43 files) was built with Claude Code but
has no trailer. We did not keep prompt logs or time how long reviews took, so we report no
measures for those.

## Confirmed by the AI Lead

No file or commit in the repo can show the three statements below, so I confirm them myself as AI
Lead (Kongphop Ruentongdi, 6631503103, 18 Nov 2026):

1. The team did not keep prompt logs and did not time code reviews.
2. The first Web Push version (commit `29b69fe`) was built with Claude Code, although the commit
   has no `Co-Authored-By: Claude` trailer.
3. `analyze_uat.py` was written with Claude.
