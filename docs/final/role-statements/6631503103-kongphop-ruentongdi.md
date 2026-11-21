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

---
## Reflection

**1. Lessons learned.**
As AI Lead, I wrote six Claude Code sub-agents for the team. Each agent carries our locked rules, such as validated Room Numbers, the audit trail and the out-of-scope list. This made AI output more consistent across five people, because everyone's AI followed the same rules.

AI changed every step of our work. For requirements and design, it helped me turn the LINE-to-Web-Push decision into new user stories (US-23 to US-25) and a design document quickly. For coding and testing, it generated most of the Web Push feature (43 files and more than 20 new tests) in one commit.

What got better: speed. A big change in scope was ready to test in a short time.

What got worse: review and security. The push code includes encryption (RFC 8291) and VAPID keys. I checked it against the RFC test vector, but I could not explain every line myself. All tests passed, but tests only check what we thought of. In UAT, real Staff still found scanner Check-In slower than their old spreadsheet. I learned that "tests green" does not mean "done". Large AI commits are also hard for teammates to review.

**2. Where I stand today.**
I am a junior engineer who can use AI to build full features quickly. But I think my real value is judgment: setting rules for AI, checking its output, and knowing when I do not fully understand something. In the AI era, writing code is easy. Making sure the code is correct and secure is the hard part, and that is where I want to be strong.

**3. My plan.**
Next year, I will finish my degree, complete an internship, and improve my English (IELTS) so I can apply for a master's degree in cyber security in Germany.
In five years, I want to work in Germany as a security engineer who secures software and AI systems. This project showed me that AI-generated code needs people who can check its security.
