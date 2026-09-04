# spec.md — Smart Dormitory Parcel Management System (SDPMS)

**Course:** 1305493 Software Engineering Case Studies, 2569 · **Stage:** DISCOVER → Design (feeds the W5 Gate) · **Sources:** company_charter.md, product_backlog.md, Proposal_Dormitory-Parcel-Management-System.pdf, survey_interview_analysis.md
**Status:** Draft — requirements + design collapsed into one spec per the course's AI-Native SDLC playbook (Stage 2). Team should review before submitting alongside feature-list.md.

---

## 1. Overview

We help dormitory parcel staff stop fighting Google Sheets during Flash Sale surges, and get residents their parcels faster. SDPMS replaces the current Google Forms/Sheets workflow with a dedicated web app for dormitory parcel staff (10 buildings) and student residents, covering intake → room/resident matching → optional LINE notification → checkout, while preserving the same step-by-step flow staff already use today.

**Observed load (confirmed, not a target):** ~417.5 in / ~417.6 out parcels/day average, peaking at **1,024/day** during Flash Sale.

## 2. Actors

- **Dormitory parcel staff** (front-desk/operator) — one role across all 10 buildings. Runs intake, matching, notifications, and checkout.
- **Student resident** — receives parcels; optionally opts in to LINE notifications; not authenticated at pickup today (no ID check).

*(Use these exact two actor names in D1/D2 diagrams — anything else won't trace back to this spec.)*

## 3. Scope

**In scope:**
- Parcel check-in: scan or type the tracking number, then validate/select the room via the resident directory (autocomplete/dropdown, not free-text)
- Search & lookup: by room number, tracking code, or resident name/nickname (plain exact/substring text search — no AI ranking or confidence-scored suggestions)
- Unmatched-parcel review queue, tagged by reason
- Parcel check-out: bulk (all open parcels for a room) or selective (one at a time)
- LINE notification on check-in, opt-in, staff-confirmed link only
- Legal/compliance logging (consent, access/action log, verifiable consent records) and AI-ethics safeguards (human confirmation, graceful degradation)

**Out of scope (this build):**
- Automated handwriting recognition (OCR) of hand-written labels — deferred, see backlog US-03
- Nickname-to-legal-name fuzzy/AI-ranked matching — search is plain text only (see §4, US-05)
- Mobile app (iOS/Android) — web application only
- Direct API integration with courier companies for automatic tracking-status updates — this also means the "courier says delivered but staff haven't keyed it in yet" gap (the most common resident complaint in interviews, 6/9, `survey_interview_analysis.md` §1) isn't closed by this build; LINE notifications correctly fire only once staff actually check the parcel in
- Any identity check or digital signature at pickup — the existing paper logbook stays a separate, unchanged, out-of-system process
- Resident self-service checkout (scan-your-own-QR) — raised by a resident in interviews, not adopted; noted as a future-version idea

## 4. Functional Requirements (traced to the backlog)

Full Gherkin acceptance criteria live in `product_backlog.md` — this table is the traceability index, not a duplicate. Every row below is a Must Have.

| Epic | Story | Requirement (one line) |
|---|---|---|
| E1 — Parcel Intake & Registration | US-01 | Scan barcode/QR to auto-capture tracking number; always routes to room/resident identification next (never auto-completes on scan alone) |
| E1 | US-02 | Manual tracking-number entry when scan fails; same room-ID handoff as US-01 |
| E2 — Resident & Room Matching | US-05 | Look up resident/LINE-link status by room number, or by plain-text name/nickname search (no AI ranking) |
| E2 | US-06 | Unmatched parcels parked in a visible queue, tagged by reason (No match / No resident / Ambiguous / Other) |
| E3 — Real-Time LINE Notifications | US-08 | Auto-send a LINE message on check-in, only if the resident's link is staff-confirmed |
| E3 | US-10 | Notification content is minimal: building, room, parcel reference only |
| E3 | US-11 | Two-step opt-in: resident adds the LINE account, staff confirms the match before notifications start |
| E4 — Parcel Check-Out | US-12 | Bulk check-out: one digital action closes every open parcel for a room, matched by per-item barcode scan at physical handover |
| E4 | US-13 | Selective single-parcel check-out, with a required reason code for anything marked missing/unclaimed |
| E4 | US-15 | Soft, dismissible name/room mismatch warning at checkout (not a hard block) |
| E5 — Legal & Compliance | LR-01, LR-03, LR-04, LR-05 | PDPA consent capture · data minimisation · ≥90-day access/action log · verifiable consent records — see `rule.md` for agent-executable rules |
| E5 | LR-02 | Access/correction/deletion rights are already actionable via the PO-email channel in `rule.md`, logged under LR-04; the in-app self-service screen is Could-Have polish, not a Sprint-0 build item |
| E6 — AI Ethics | ET-01, ET-04 | Human confirmation required for every AI suggestion (forward-looking — no AI feature is actively triggered yet; US-05 is plain-text search, and applies fully once US-03/OCR ships) · graceful degradation if OCR/LINE is unreachable |

## 5. Tech Stack & Architecture

| Layer | Choice |
|---|---|
| Frontend (client) | React.js (UI) + Tailwind CSS (styling) |
| Backend (application server) | Go, Gin framework |
| Database | PostgreSQL |
| Deployment | Docker |

**Architecture:** three-tier — Client (React, handles check-in/check-out/search UI) → Backend API (Go/Gin, owns room-number validation and barcode-handling business logic) → PostgreSQL (residents, rooms, parcels, staff, status, consent, access_log tables). All client↔server traffic over HTTPS.

D3 (architecture diagram) must show this exact three-tier shape and must not contradict Go/Gin as the backend — that's the "agrees with your tech stack" check the diagram-checker subagent runs.

## 6. Non-Functional Requirements

- **Performance:** scan-to-record under 2 seconds; room/resident search under 1 second; no degradation at the observed 1,024/day Flash Sale peak.
- **Security:** HTTPS on all traffic; staff passwords hashed and salted; PostgreSQL encrypted at rest and in transit; role-based access so staff only see data relevant to their duties.
- **Compliance:** PDPA, Computer Crime Act §26, Electronic Transactions Act §9/26/28 — agent-executable rules in `rule.md`.
- **Reliability / graceful degradation:** if OCR or the LINE API is unreachable, check-in/check-out must still work — OCR failure falls back to manual entry (US-02); LINE failure queues the notification instead of blocking the workflow (ET-04).
- **Data retention:** parcel records kept only as long as operationally necessary, then archived or removed; access/action logs kept a **minimum** of 90 days regardless.
- **Accessibility:** low-typing workflow (autocomplete/dropdown, barcode scan over free-text), sufficient color contrast, keyboard navigation — usable under peak-hour pressure by staff of varying technical proficiency.

## 7. Data Constraint (known project risk)

No real resident data is available for development or testing — one of the five interviewed staff (แดง) explicitly declined to release real data and told the team to mock it instead. The team must generate synthetic parcel/resident data that mirrors the real schema and the observed volume pattern (~400–1,000 records/day), validate its realism with dormitory staff before final testing, and only bring in real historical data at cutover. Synthetic data must never be copied or derived from real records (ties to the PDPA minimisation rule in `rule.md`).

## 8. One Core Workflow (must match every other artifact)

Scan → validate room/resident against the directory → notify (LINE, opt-in) → check out (bulk or selective).

Every diagram, the user-journey, and the prototype (produced separately for the W4 design pack) must trace back to this same thread — see `feature-list.md` for which single feature is marked as the starting point of that thread.
