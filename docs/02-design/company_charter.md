# Company Charter — JOBAS Company
**Course:** 1305493 Software Engineering Case Studies, 2569 · **Deliverable:** Week 1 (due Aug 5) — being finalized retroactively from your Week 3 proposal/interview data
**Status:** Submitted (Company #21, Aug 31 2026)

---

## 1. Company name & one-line pitch

**Company name:** JOBAS Company

**One-line pitch:** We help dormitory parcel staff stop fighting Google Sheets during Flash Sale surges — and stop handing a resident's parcel to the wrong room.

---

## 2. Team & roles

Five roles per the course guardrail (Product Owner, Tech Lead, AI Lead, Designer, QA/Test) — one each.

| Student ID | Name | Role |
|---|---|---|
| 6631503034 | Phuriphat Chantiuaong | Designer |
| 6631503040 | Sadayu Suriya (Petch) | Tech Lead |
| 6631503042 | Supawan Kongsapcharoen | Product Owner |
| 6631503103 | Kongphop Ruentongdi | AI Lead |
| 6631503106 | Danaiphong Songsikhwa | QA / Test |

---

## 3. Three pains (from real interviews and staff shadowing)

1. **Identification failures** — parcels routinely arrive with no visible room number; searching by name often fails because residents write nicknames on delivery labels that don't match official student records.
2. **System inefficiency** — the current Google Forms/Sheets workflow slows to a crawl during busy hours, and breaks down further during Flash Sale surges (up to 1,024 parcels/day vs. a normal ~418/day).
3. **Slow checkout** — the current Google Form workflow only lets staff submit one parcel at a time, so a resident with several parcels — or a long line at the counter — waits far longer than necessary. *(Room-mismatch/misdelivery is real too, but it's fundamentally human error the system can only nudge against, not fix — so it's out of scope as a headline pain here; the backlog still covers it as a soft warning, US-15.)*

## 4. Product direction

Web app that validates room/resident against the official directory at check-in and supports bulk + selective check-out — same flow staff already use.

## 5. Target users & where to find them

**Who:** dorm parcel staff (10 buildings) + student residents.
**Where:** Baansoi5 Dormitory — parcel counters (peak + quiet hours), resident common areas.

## 6. Core workflow (one sentence)

Scan → validate room/resident → notify (LINE, opt-in) → check out (bulk or selective).

## 7. Success metric

Search/retrieval time per parcel; checkout time per resident — before vs. after.

## 8. Interview plan & evidence log

**Target:** ≥15 real users for the stretch target; Gate itself needs ≥5. No classmates, no AI personas. 9 residents + 6 staff-side sources already collected (see evidence log below) — target met.

**This week's plan:** Nina → interview the dormitory parcel staff, and designed the survey questions for student residents.

**Evidence log:** `survey_interview_analysis.md` (same folder) — resident survey (9) + staff interviews (5 regular staff + 1 part-time), cross-referenced against this charter's pains and the backlog.
