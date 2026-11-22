# Role Statement — Sadayu Suriya (6631503040)

**Role:** Tech Lead · JOBAS Company #21 · DPMS

## What I owned

I owned the technical side from repo setup to deployment. I set up the repository structure, CLAUDE.md and a few agents and skills, so everyone on the team, and every AI tool, worked to the same scope and rules. I built the Go/Gin API and the PostgreSQL schema, including Room Number validation against the directory and the audit trail. Then I merged the React UI with the backend. When the team dropped LINE, I replaced it with the Web Push Resident page and added Parcel edit, the summary board and roomless Check-Out. I set up CI on GitHub Actions and the single-image deploy to Render. I fixed the seven QA and security findings (QA-01…QA-07), each with a regression test. I wrote the Test Plan's first execution round. I prepared the UAT dataset and turned the UAT results into the final evidence. As Tech Lead I reviewed and merged the team's pull requests.

## Evidence

- Repo, agents and skills setup: [20b40dd](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/20b40dddb74d1d4fdbdb6e1280ac5d2c63594d6b)
- Backend API and schema: [b4c1d15](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/b4c1d1547f86d8ecebc863e89938cc3d28ead71b)
- UI and backend merged: [d0fe4e9](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/d0fe4e90511cbba992fc932ef3b140d0e11616e3)
- Resident page, Parcel edit, summary board: [4782b57](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/4782b5709034012275d3f9e4bdfe197ab442406c)
- CI/CD and Render deploy: [3fbbc71](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/3fbbc7147318c321683d7e7f83e4fde4fb4c27f0)
- QA-01…QA-07 fixes: [b0a35e6](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/b0a35e6fdc15df97a7e56a6fe639f14aee32ea2c)
- Test Plan execution round: [acd3e7c](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/acd3e7c5f00051bea54b5ce60ed45f20c2730444)
- UAT results and final docs: [88acbbd](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/88acbbd2869e9a4b2797f7c13955af6e93c4fd6b)

## AI disclosure

I used Claude (Claude Code) with the project's agents and skills to write and refactor backend and frontend code, write tests, review security, and draft documents. Claude is credited as co-author on those commits. I reviewed and tested every change before merging it, and the technical decisions are mine. Claude also helped draft this statement, and I checked it for accuracy.

## Reflection

### 1. Lessons learned

Building DPMS with AI made the build phase much faster. Code, tests and fixes that would have taken
days took hours. On the night before the final check, we fixed two Critical defects, each with a
regression test, in one night. Because building took less time, the team could spend more of it on
requirements, design and testing, including a UAT with 5 Staff and 5 Residents.

What got worse was not really caused by the AI. Most problems came from us, the developers, giving
it unclear or incomplete instructions. When a request was missing detail, the AI filled the gap: it
wrote "before" descriptions with no evidence behind them, committed Go code that failed the gofmt
check in CI, and sometimes changed parts of the code we had not asked it to touch. The lesson for me
is that every instruction must be clear and complete, and every AI change must be reviewed before it
is merged. That is why we wrote the team's rules in `CLAUDE.md`.

### 2. Where I stand in the software industry today

I think software engineers still have a place in the AI era, but the work is changing. Building
becomes easier, so the engineer's job moves towards design and towards judging the work the AI
produces. In this project I already worked that way. As Tech Lead, I spent less time typing code
and more time writing the rules the AI works by, reviewing pull requests and deciding what to merge
and deploy. I see myself as someone who has started to adapt to this new way of working.

### 3. My plan

Next year I plan to work while I keep learning: improving my language skills and deepening my
knowledge of the field. Within five years I want to do a master's degree abroad. Before that, I plan
to build up my savings so that I can study without worrying about money.
