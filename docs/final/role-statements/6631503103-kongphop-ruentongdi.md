# Role Statement — Kongphop Ruentongdi (6631503103)

**Role:** AI Lead

## What I owned

**AI agent setup.** I wrote six of the eight Claude Code sub-agents the team uses to build the system
(commit `4950e07`): [backend-go](../../../.claude/agents/backend-go.md),
[frontend-react](../../../.claude/agents/frontend-react.md), [db-postgres](../../../.claude/agents/db-postgres.md),
[qa-tester](../../../.claude/agents/qa-tester.md), [data-seeder](../../../.claude/agents/data-seeder.md) and
[devops-docker](../../../.claude/agents/devops-docker.md). Each agent carries the project's locked rules for its
area, such as validated Room Numbers, the audit trail and the out-of-scope list, so AI output stays
inside scope and matches the stack.

**Resident notification page (Epic E3).** I built the first version of Web Push notifications, which
replaced LINE (commit `29b69fe`, 43 files): the design in
[web-push-notification.md](../../../docs/02-design/web-push-notification.md), migration
[0005](../../../db/migrations/0005_web_push_notifications.sql), the push sender and
[notify worker](../../../backend/internal/notify/worker.go), desk OTP registration, and the Resident PWA under
[`src/resident/`](../../../docs/02-design/prototype/src/resident/). I added tests for both sides
([push_test.go](../../../backend/internal/api/push_test.go),
[ResidentApp.test.jsx](../../../docs/02-design/prototype/src/resident/ResidentApp.test.jsx)).
Work log: [20261021-web-push-notifications.md](../../../docs/05-log/20261021-web-push-notifications.md).

**UAT with real users (supporting).** I helped a teammate collect and analyse the UAT round 1 results
from real Staff and Residents. The final results are in
[docs/03-test/results/20261102-uat/](../../../docs/03-test/results/20261102-uat/README.md), but my part
(running sessions and working through the responses) was done outside the repo, so it has no commit under my name.

**Staff journey.** I drafted the first [user journey](../../../docs/02-design/user_journey.md) (commit `7e4f515`).

## AI disclosure

I used Claude Code (Anthropic) to draft the agent files and to generate much of the Web Push code and
tests. I reviewed, ran and tested the output before committing. Claude also helped draft this
statement from the git history; I checked every claim against the commits.
