# AI logic — where AI is used, how, how we prove it, how we measure it

> **For the AI Lead (Kongphop) to review before the presentation.** Items marked
> `[AI Lead: confirm]` need your answer; everything else is taken from files in this repo.

## Summary

**DPMS has no AI feature in the product.** Check-In, Check-Out, search and the dashboard are
rule-based: the Room Number is chosen from the Resident directory, search is plain-text matching,
and nothing is predicted or ranked. The only planned AI feature — reading the label with OCR and
suggesting a room (US-03) — is *Should Have* and was not built, to keep the scope to the four core
features. AI was used **in how we built the system**: requirements, code, tests and reviews, with a
person reviewing every change.

## 1. Where

| Area | AI used? | What |
|---|---|---|
| Product — Check-In / Check-Out / search / dashboard | **No** | Rule-based. Room Number validated against the directory (`422 ROOM_NOT_IN_DIRECTORY`). |
| Product — label OCR / room suggestion (US-03) | **No — not built** | Deferred. Its safeguards are already written as requirements (see 4). |
| Requirements | Yes | `requirement-writer` and `backlog-auditor` agents, `/capture-requirement` and `/audit-backlog` skills drafted and checked backlog entries. |
| Design | Yes | `design-spec` skill (locked design decisions in `docs/02-design/design-spec.md`); Impeccable skill critiqued the UI (see the Designer's role statement). |
| Code | Yes | Claude Code (`backend-go`, `frontend-react`, `db-postgres`, `devops-docker` agents); one commit from GitHub Copilot's agent. |
| Tests and test data | Yes | `qa-tester` agent for unit/integration tests and the load test; `data-seeder` agent for the synthetic directory and Parcels (`backend/cmd/seed`). `[AI Lead: confirm which tests and data each agent produced]` |
| Reviews | Yes | `code-review` and `security-audit` skills; QA/security review of 1 Nov (QA-01…QA-07). `[AI Lead: confirm which findings were found by AI and which by a person]` |
| UAT analysis | Yes | `analyze_uat.py` (written with Claude) recomputes SUS/TAM and task times from the raw workbook. |

Project setup for AI: `CLAUDE.md` (rules every agent must follow — scope, terminology, the
non-negotiable constraints), `.claude/agents/` (8 agents), `.claude/skills/` (7 skills),
`.codex/agents/` (the same 8 agents for Codex), `AGENTS.md`.

## 2. How

1. **Rules first.** `CLAUDE.md` fixes the scope (4 features), the stack, and constraints the AI must
   not break: Room Number never free text, append-only audit trail, RBAC in the API, PDPA rules from
   `rule.md`.
2. **One specialist agent per area**, each with its own instructions in `.claude/agents/`.
3. **A person owns every change.** AI output goes into a branch and a pull request; a team member
   reviews and merges it. Commits made with Claude carry a `Co-Authored-By: Claude` trailer so the
   share of AI-assisted work is traceable.
4. **Tests gate every change.** CI (GitHub Actions) runs the Go and Vitest suites on each pull
   request.

## 3. Prove — test set, baseline, evaluation

Because the AI wrote code, not a model inside the product, "proving" it means showing that
AI-assisted code passes the same tests as any other code, and that AI-assisted fixes really fixed
the defect.

| What | Test set | Baseline (before) | Result (after) | Evidence |
|---|---|---|---|---|
| AI-assisted code is correct | 159 Vitest tests + 52 Go tests (integration against a real PostgreSQL, 0 skipped) | — | **211 / 211 pass** on build `9344cff` | [unit results](../03-test/results/20261102-unit/README.md) |
| AI-assisted fixes of the 1 Nov QA review (commit `b0a35e6`, Claude co-authored) | Regression tests in `qa_review_test.go`, `Modals.CheckOut.test.jsx`, `errorMessages.test.js` | Each test **fails** on the code before the fix (e.g. reused cookie after logout → `200`; `npm audit` 10 packages) | Each test **passes** after the fix (→ `401`; `npm audit` 0) | [BUGS_AND_SECURITY_TODO](../03-test/BUGS_AND_SECURITY_TODO_2026-11-01.md) |
| AI-assisted UAT fix (commit `5da15cc`, Claude co-authored) | UAT tasks UAT04–UAT06 with real Staff | U01, U02 on the old build: 4 errors, UAT06 Fail (UAT-D03, UAT-D05) | U03–U05 on the fixed build: 0 errors, UAT06 Pass | [UAT results](../03-test/results/20261102-uat/README.md) |
| System as a whole | 64 system test cases (TC01–TC64) on synthetic data | — | 52 Pass / 3 Fail / 9 Blocked | [results.json](../03-test/results/20261028/results.json) |
| UAT numbers are computed correctly | `analyze_uat.py` recomputes SUS/TAM independently of the spreadsheet formulas | Spreadsheet formulas | Same values for all 10 participants | [analyze_uat.py](../03-test/results/20261102-uat/analyze_uat.py), [summary.txt](../03-test/results/20261102-uat/summary.txt) |

Limits of this proof: passing tests show the code does what the tests check, not that the tests are
complete; the 3 failing and 9 blocked system test cases are listed in `results.json`. We have **no
baseline for development speed without AI** — we did not build any feature twice — so we make no
claim that AI made the team faster.

## 4. Safeguards for a future AI feature (already in the backlog)

- **ET-01 Human confirmation**: an OCR read or room suggestion only saves after Staff accept, edit
  or reject it; no "auto-apply above X% confidence".
- **ET-04 Graceful degradation**: if OCR is down, Check-In falls back to manual entry (US-02).
- Room Number validation in the API applies to any value, typed or suggested.

Source: [product_backlog.md](../01-requirements/product_backlog.md), epic E6.

## 5. Measure

| Measure | Value | How to reproduce |
|---|---|---|
| Commits on `main` with a `Co-Authored-By: Claude` trailer | **13 of 52** non-merge commits (25%), 26 Aug – 17 Nov 2026 | `git log origin/main --no-merges --grep="Co-Authored-By: Claude" -i --oneline \| wc -l` |
| Commits by GitHub Copilot's agent | 1 | `git log origin/main --no-merges --author=copilot --oneline` |
| AI-assisted fixes verified by a failing-then-passing regression test | 7 (QA-01…QA-07) | [BUGS_AND_SECURITY_TODO](../03-test/BUGS_AND_SECURITY_TODO_2026-11-01.md) |
| Agents / skills set up for the project | 8 agents, 7 skills | `ls .claude/agents .claude/skills` |
| Accuracy of an AI feature in the product | **N/A** — no AI feature in the product | — |

The trailer count is a lower bound: work done with AI help but committed without the trailer is not
counted.. `[AI Lead: add any other AI use the team tracked, e.g. prompts kept, review time]`
