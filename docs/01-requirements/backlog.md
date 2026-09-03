# Product Backlog — Dormitory Parcel Management System

> The single ordered list of everything the system might need. One row per item.
> Full detail (acceptance criteria, data, compliance) lives in `01-spec/`.
> Maintain with the `requirement-writer` agent / `/capture-requirement`; check with
> `backlog-auditor` / `/audit-backlog`.

Last updated: 2026-09-04 | Status: **DRAFT** — seeded from the proposal's in-scope list,
not yet refined into INVEST-sized stories.

## Legend

- **Priority (MoSCoW):** Must · Should · Could · Won't-now
- **Status:** draft · ready · in-progress · done · blocked · deprecated · `SCOPE-CREEP`
- **Trace:** the proposal objective/section the item serves

## Backlog

| ID | Title | Story (short) | Priority | Status | Spec file | Trace |
|----|-------|---------------|----------|--------|-----------|-------|
| FR-1 | Parcel check-in | As a staff operator, I want to scan a parcel and record it against a validated room number and storage location, so that it can be found later | Must | draft | — | Obj. 2, §4.1 Check-In |
| FR-2 | Room-number validation at check-in | As a staff operator, I want the room field to accept only rooms in the resident directory, so that mis-identified parcels are prevented at entry | Must | draft | — | Obj. 2, Problem Statement |
| FR-3 | Storage-location assignment | As a staff operator, I want to tag each parcel with building (1–10 or Common Area) and shelf/bin, so that mis-shelved parcels stop happening | Must | draft | — | §4.1 Storage Tracking |
| FR-4 | Check-out — all pending for a room | As a staff operator, I want to check out every pending parcel for a room in one action, so that collection is fast at peak times | Must | draft | — | Obj. 4, §4.1 Check-Out |
| FR-5 | Check-out — individual parcel | As a staff operator, I want to check out selected parcels one at a time, so that partial pickups are handled | Must | draft | — | Obj. 4, §4.1 Check-Out |
| FR-6 | Search & lookup | As a staff operator, I want to search parcels by room number, tracking code, or resident name, so that I can locate any parcel quickly | Must | draft | — | §4.1 Search & Lookup |
| FR-7 | Resident-name search with nickname fallback | As a staff operator, I want name search to still help when the label used a nickname, so that unlabelled parcels are not dead ends | Should | draft | — | Problem Statement |
| FR-8 | Daily status dashboard | As a staff operator, I want counts of received / picked up / pending for the day, so that I know the desk's state at a glance | Must | draft | — | §4.1 Daily Status Overview |
| FR-9 | Resident/room directory reference (read-only) | As a staff operator, I want to look up the official resident/room list, so that I can confirm an entry | Should | draft | — | §4.1 Directory Reference |
| FR-10 | Staff sign-in | As a staff member, I want to sign in with a username and password, so that my actions are attributed to me | Must | draft | — | §8.1 |
| FR-11 | Role-based access control | As an admin, I want staff to see only what their role allows, so that access is limited to responsibilities | Must | draft | — | §8.1 |
| FR-12 | Audit trail on every check-in/check-out | As an admin, I want every check-in and check-out recorded with staff ID and timestamp, so that misdelivery disputes can be resolved | Must | draft | — | §8.2 |
| NFR-1 | Peak-load performance | The system serves check-in/check-out/search within target latency at 1,024 parcels/day (Flash Sale) | Must | draft | — | Obj. 1, Performance Risk |
| NFR-2 | Indexed lookups + pagination | Room-number and tracking-code lookups use indexes; all list endpoints paginate | Must | draft | — | Performance Risk |
| NFR-3 | Spreadsheet-like UI | Screens mirror the existing Google Sheets/Forms layout and flow | Must | draft | — | Obj. 3, User Adoption Risk |
| NFR-4 | Low-typing workflow | Barcode scan + dropdown/autocomplete instead of free text; keyboard navigable; sufficient contrast | Must | draft | — | §8.4 |
| NFR-5 | Data protection in transit & at rest | HTTPS in front of the app; PostgreSQL encryption at rest and in transit; passwords hashed + salted | Must | draft | — | §8.1 |
| NFR-6 | Access/traffic log retention ≥ 90 days | Access and action logs are retained ≥ 90 days and tied to a real user | Must | draft | — | rule.md — Computer Crime Act §26 |
| NFR-7 | PDPA handling of resident data | Consent, purpose limitation, minimisation, and access/correct/delete for resident personal data | Must | draft | — | rule.md — PDPA |
| NFR-8 | Digital evidence of handover confirmation | Any "I agree" / parcel-handover confirmation captures reliable digital evidence of the action | Should | draft | — | rule.md — Electronic Transactions Act §9/26 |
| NFR-9 | Parcel-record retention & archival | Parcel records are archived (not hard-deleted) after a defined window post-pickup | Should | draft | — | §8.3 |

## Scope-creep parking lot

Items raised that are **outside** the locked scope (Check-In, Check-Out, Search, Dashboard,
Directory, audit trail). Do not build until advisor review (proposal Scope Creep mitigation).

| ID | Title | Raised by / date | Notes |
|----|-------|------------------|-------|
| — | *(none yet)* | | |

## Out of scope (proposal §4.2 — will not build)

- Handwriting/label OCR
- Mobile app (iOS/Android) — web only
- Direct courier-API tracking integration
