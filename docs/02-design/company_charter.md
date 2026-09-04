# Project Charter for Software Engineering Case Studies

**Project Title:** Dormitory Parcel Management System (DPMS) — a web application

**Company:** JOBAS Company · Company #21
**Course:** 1305493 Software Engineering Case Studies, 2569
**Charter last revised:** 2026-09-04

---

## Team Members & Role

| # | Name | Student ID | Role |
|---|---|---|---|
| 1 | Supawan Kongsapcharoen | 6631503042 | Product Owner |
| 2 | Sadayu Suriya (Petch) | 6631503040 | Tech Lead |
| 3 | Kongphop Ruentongdi | 6631503103 | AI Lead |
| 4 | Phuriphat Chantiuaong | 6631503034 | Designer |
| 5 | Danaiphong Songsikhwa | 6631503106 | QA / Tester |

---

## Purpose

To replace the dormitory front desk's slow, error-prone Google Forms/Sheets parcel workflow with a web application that keeps parcel handling fast and accurate — even during Flash Sale surges — and gets each resident the right parcel the first time.

---

## Problem Statement

Baansoi5 Dormitory handles about 418 incoming and 418 outgoing parcels per day, surging to roughly 1,024 per day during Flash Sale periods. The current Google Forms/Sheets workflow slows to a crawl under this load. Parcels often arrive with no room number, and the names on labels are nicknames that don't match official student records, so staff cannot find the owner. Check-out is one parcel per form submission, so a resident with several parcels — or a queue at the counter — waits far longer than necessary. Room numbers are also written unclearly or swapped, sending parcels to the wrong resident.

---

## Objectives

- Make check-in and check-out faster and less dependent on searching and retyping.
- Enforce a valid room number at check-in so parcels can always be traced to a resident.
- Let staff check out all of a resident's pending parcels in one action.
- Keep the system fast and reliable during Flash Sale peak load.
- Improve staff and resident satisfaction with the parcel process.

---

## Scope

The project covers the dormitory front-desk parcel workflow — check-in, check-out, search, and a daily status view — for parcel staff across all 10 buildings and for student residents at Baansoi5 Dormitory. It replaces the current Google Forms/Sheets process with a dedicated web application.

**In scope:** parcel check-in with a directory-validated room number; parcel check-out (bulk or selective); search by room number, tracking code, or resident name; a daily status dashboard; a read-only resident/room directory; an audit trail on every check-in and check-out; opt-in LINE notification on check-in.

**Out of scope:** storage-location (shelf/bin) tracking; handwriting OCR of labels; nickname-to-legal-name AI matching; a mobile app (web only); direct courier-API integration; any identity check or digital signature at pickup; resident self-service check-out.

---

## Target Users / Stakeholders

**Target Users**

- Dormitory parcel staff (one operator role across all 10 buildings)
- Student residents

**Stakeholders**

- Baansoi5 Dormitory management / owner
- Dormitory parcel staff
- Student residents
- Course advisor (project gate reviewer)

---

## Proposed Solution

Develop a three-tier web application — React front end, Go/Gin API, PostgreSQL database. Staff scan a parcel's tracking barcode, choose the resident's room number from a directory-validated dropdown, and the parcel is recorded. At pickup, staff search by room number and either check out all pending parcels in one action or select individual items. A dashboard shows the day's received / picked up / pending counts, and every check-in and check-out is logged with staff ID and timestamp. Any AI-assisted step (such as future label OCR) always requires human confirmation, and the workflow keeps working if that service is unavailable.

---

## Key Features

- **Barcode check-in** — scan or type the tracking code, then select a room number validated against the resident directory (dropdown/autocomplete, never free-text)
- **Parcel check-out** — check out every pending parcel for a room in one action, or select individual items
- **Search & lookup** — by room number, tracking code, or resident name/nickname; fast under concurrent load
- **Daily status dashboard** — received / picked up / pending counts for the day
- **Read-only resident/room directory** reference
- **Audit trail** — every check-in and check-out records staff ID + timestamp (append-only)
- **Opt-in LINE notification** on check-in (staff-confirmed link only)

---

## Success Criteria / KPIs

- Reduced search/retrieval time per parcel compared with the current Google Sheets process.
- Reduced check-out time per resident with multiple parcels (one digital action, not one form per parcel).
- No measurable slowdown at the Flash Sale peak of ~1,024 parcels/day.
- Fewer misdelivered parcels, from enforced room-number validation at check-in.
- Improved staff and resident satisfaction, measured before vs. after implementation.

---

## Timeline / Milestones

| Phase | Timeline | Milestone |
|---|---|---|
| 1. Discover | Week 1–5 | Interview dormitory owner / staff / residents, identify pain points, define check-in / check-out / search / dashboard requirements, prepare the product backlog, a design draft, and compliance (PDPA) documents. Ends with the User Validation Gate (≥5 real users). |
| 2. Build | Week 6–8 | Finalize project scope, design the three-tier system architecture (React / Go+Gin / PostgreSQL), develop the check-in/check-out workflow, and prepare the Alpha Demo. |
| 3. Test | Week 9–11 | Test check-in / check-out / search, load-test against the Flash Sale peak (~1,024 parcels/day), conduct UAT with dormitory staff, and collect satisfaction/usage metrics. |
| 4. Deliver | Week 12–14 | Validate the system with real users, refine it based on feedback, prepare the final demo, and present the final project. |

---

## Risks & Constraints

- No real resident data is available for development or testing — one staff member declined to release it and told the team to mock it. The team must generate synthetic data that mirrors the real schema and volume.
- The system must stay fast during Flash Sale peaks (up to ~1,024 parcels/day); performance is a key risk.
- Room number must be validated against the official resident directory (no free-text), so the system depends on an accurate, up-to-date directory.
- Staff are used to the current Google Sheets/Forms workflow and may need time to adjust; the UI must closely mirror it.
- The system relies on external pieces (barcode scanning, LINE notifications); check-in and check-out must keep working if those are unavailable.
- A team of 5 on a fixed ~14-week academic timeline — scope must stay strictly limited to the core workflow.

---

## Assumptions

- The dormitory can provide an accurate, up-to-date resident/room directory.
- Parcel staff have a device with a barcode scanner or camera at the counter.
- Residents are willing to opt in to LINE notifications.
- Dormitory management and staff support replacing the manual Google Forms/Sheets process.
- Real historical parcel data is loaded only at cutover, not during development.

---

## Legal & Compliance

- **PDPA** — obtain plain-language consent before storing a resident's name, room number, or LINE ID; use the data only for parcel handling; let residents access, correct, or delete their data.
- **Computer Crime Act §26** — keep an access/action log (login, check-in, check-out, override), each entry tied to a real user, for at least 90 days.
- **Electronic Transactions Act §9 / 26** — record verifiable consent (who consented, the exact text/version shown, and when) whenever a resident agrees to something. Parcel pickup stays on the existing paper logbook, not an in-system e-signature.

---

## Evidence Log & Interview Plan

The gate requires ≥5 real users; the team collected **15** — 9 student residents (Google Form survey, 24–27 Aug 2026) and 6 parcel staff (5 regular staff in a group interview, 1 part-time). No classmates, no AI personas.

Full analysis and raw findings: [survey_interview_analysis.md](survey_interview_analysis.md).


