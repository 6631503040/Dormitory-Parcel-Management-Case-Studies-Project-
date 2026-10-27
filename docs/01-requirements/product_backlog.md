# Product Backlog — Dormitory Parcel Management System (DPMS)
**Course:** 1305493 Software Engineering Case Studies, 2569 · **Phase:** DISCOVER (W1–W5) · **Deliverable:** Week 3 → Week 5 User Validation Gate
**Scope:** Core workflow only — intake → match → link/check → checkout, with legal/AI-ethics compliance built into the workflow, per the course guardrail *"buildable in 1 month, exactly 1 core workflow, no more."*

---

## 1. How to read this backlog

**ID key:** `US-##` = User Story (a feature a real user asked for, sourced from interviews) · `LR-##` = Legal Requirement (a duty the law imposes on us regardless of whether any user asked for it) · `ET-##` = Ethics requirement (a safeguard the ETDA AI Ethics guideline requires around our AI features, e.g. OCR/matching).

**Why LR and ET are split out from US instead of folded in:** they come from a different source and a different owner. A `US` story is justified because a resident or staff member told you it hurts — you can point to an interview quote. A `LR` story is justified because a law says so, whether or not anyone asked for it — you point to a statute section instead. An `ET` story is justified because the AI Ethics guideline requires it whenever an AI/OCR step is involved. Keeping them as separate IDs makes each one traceable to its actual source (which the W5 Gate rubric checks), and stops legal/ethics duties from quietly disappearing when a story gets simplified. In practice a legal or ethics duty is often *attached to* a user story (e.g. LR-05's e-signature requirement lives inside the US-11 LINE-linking flow) — the split is about bookkeeping and traceability, not about building them as separate screens.

Each story below is written as `As a <role>, I want to <action>, so that <value>`, with a MoSCoW priority and testable Acceptance Criteria.

---

## 2. Epic Map

| Epic | Name |
|---|---|
| **E1** | Parcel Intake & Registration |
| **E2** | Resident & Room Matching |
| **E3** | LINE Parcel-Status Check & OTP Identity Verification |
| **E4** | Parcel Check-Out (Bulk + Selective) |
| **E5** | Legal & Compliance (PDPA · CCA §26 · ETA §9) |
| **E6** | AI Ethics & Human-in-the-Loop Safeguards |

*(E1–E6 run in a straight line, no gaps. Two more epics — Staff Operations Console, Multi-Building Admin — exist in the full backlog but aren't part of this core-workflow slice; see Section 5.)*

---

## 3. Core Workflow Stories (Sprint-0 scope — all Must Have)

### E1 — Parcel Intake & Registration

> Intake is always two parts, not one: (1) capture the parcel's tracking number — either by scan or by typing it (courier/company identity is not collected — see the minimisation note below), and (2) identify which resident/room the parcel is for, which a barcode never encodes, so it always needs a human step (Epic 2). Scanning removes the typing for part 1 only; it does not remove part 2.

**US-01 — Barcode/QR intake scan**
As a dormitory parcel staff member, I want to scan a package's barcode/QR label to auto-capture the tracking number, so that I only have to identify the room instead of retyping the whole label.
- Given a scannable barcode, when staff scans it, then a parcel record with tracking # and timestamp is created in under 2 seconds, and the screen immediately prompts for room/recipient — by typing the room number seen on the label, or by searching the resident's name/nickname (US-05) — before the record is considered complete (routes into Epic 2, not auto-saved as "done").
- Given a parcel with the same tracking number is already open (not yet checked out), when that number is scanned/entered again, then the system warns "possible duplicate" instead of silently duplicating — the check is based on open status, not a time window.
- The record does **not** capture which courier/company delivered it — only the tracking number is needed to identify the parcel (see LR-03, data minimisation).

**US-02 — Manual entry fallback for the tracking number**
As a dormitory parcel staff member, I want to manually enter the tracking number when a barcode is missing or unreadable, so that I never lose a record because of bad packaging — this replaces only the scan step, not the separate room-identification step in Epic 2.
- Given a barcode fails 3 scans, when staff taps "Enter manually," then a form opens for the tracking number, then hands off to the same room/recipient step as US-01 (Epic 2) — manual entry is not a shortcut that skips room identification.
- Given staff cannot determine a room at all (illegible, missing), then submission of that field is skipped and the parcel routes to the unmatched queue (US-06) instead of saving a null room.

### E2 — Resident & Room Matching

**US-05 — Search resident by room number, or by name/nickname**
As staff, I want to look up who's assigned to a room, or search by the name/nickname written on the package when the room isn't legible, so that I can confirm who a parcel belongs to.
- Given a valid room number, when staff searches, then the resident's name and LINE-link status return in under 1 second.
- Given no resident is on file for that room, then the system says so clearly and routes to US-06.
- Given only a name/nickname is legible, when staff types it into search, then the system returns **plain text matches only** (exact or partial substring) — no AI ranking, confidence score, or suggested "best guess."
- Given a name/nickname search returns exactly one match, the system asks a direct yes/no confirmation — "Is this Room 304 — Warinthorn K.?" — before assigning the parcel. Given it returns zero or more than one match, it routes to US-06 instead (tagged No match or Ambiguous).

**US-06 — Unmatched-parcel review queue**
As staff, I want unmatchable parcels parked in a visible queue, tagged with *why* they're stuck, so that nothing gets lost and supervisors can triage by cause instead of re-diagnosing every parcel from scratch.
- Given a parcel can't be resolved, then it's tagged with one reason: **No match** (the room number or name/nickname search returned nothing), **No resident** (room number is valid but nobody's on file for it), **Ambiguous** (the name/nickname search text matches residents in two or more rooms — e.g. the same nickname appears in 3 rooms), or **Other**.
- Given a parcel is tagged, then it appears on a building-wide queue, oldest first, filterable by reason.
- Given a supervisor resolves a queued parcel, the resolution is logged with staff account, timestamp, and reason.

### E3 — LINE Parcel-Status Check & OTP Identity Verification

> LINE linking is an opt-in convenience, not something every resident has — it's not a data source staff depend on. The value: a linked resident can tap a "Check Parcel" button (rich-menu icon, `backend/img/percel_icon.png`) in the dorm's LINE chat at any time to see whether something is waiting for them, instead of asking staff in person or trusting a courier app that may say "delivered" before staff have keyed the parcel into this system. This is a pull, not a push — the system never messages a resident on its own; it only answers when asked. Most residents may never link at all, and that's the normal, expected state — not something to chase down.
>
> Interviews (`survey_interview_analysis.md` §1) found the single most common resident complaint (6/9) is that a courier's shipping app shows "delivered" before staff have keyed the parcel into this system, so the resident finds nothing yet when they check. That gap belongs to the courier, not to SDPMS — closing it would mean live courier-API integration, which is out of scope for this build (`spec.md` §3). A status check made before staff have keyed the parcel in correctly returns "not yet," not a false positive — that's intended behavior, not a bug to chase.

**US-08 — On-demand parcel-status check via LINE**
As a linked student resident, I want to tap a "Check Parcel" button in LINE, so that I can see whether I have anything waiting without asking staff or waiting for a notification that might never come.
- Given a resident's LINE account is linked to their room, when they tap the "Check Parcel" icon, then the bot replies within a few seconds with the count and status (pending) of open parcels for that room.
- Given the resident's LINE account is not yet linked, tapping "Check Parcel" prompts them to link first (US-11) instead of returning any parcel data.
- Given a resident has no open parcels, the bot says so plainly instead of returning nothing.

**US-10 — Minimal-data status-check content**
As a student resident, I want a status reply that identifies my parcel without exposing sender or other residents' info, so that my privacy is protected.
- The reply includes only building, room, count of pending parcels, and each parcel's system-generated reference — no courier/company identity, no other resident's name, no payment/CoD amount, no shipment contents.

**US-11 — OTP-verified LINE linking**
As a student resident, I want to prove I actually live in the room I claim before my LINE account gets linked to it, so that only the real occupant can check that room's parcel status.
- Linking is a four-step challenge, all required: (1) the resident messages the dorm's official LINE account with their claimed room number; (2) the system generates a single-use OTP (random code) tied to that room number and that LINE account, valid for a short window; (3) a staff member looks up the pending code for that room and reads it to the resident in person at the parcel desk — this in-person hand-off is the actual identity check, same as the rest of the current desk process, no digital signature involved; (4) the resident types the code back into the LINE chat, the bot asks them to confirm it, and only a correct match links the LINE account to that room.
- Given the code doesn't match, or expires before it's used, the link is refused and the resident must restart from step 1 — the system never links on a guess.
- Given a link succeeds, the system records the room, the LINE account, which staff member issued the code, when, and the exact consent text the resident was shown before the code was generated — before any status check is ever answered (ties to LR-05).
- Given a resident wants to stop being linked, they can unlink themselves (e.g. by unfriending the LINE account) or ask staff to unlink them; either way, the "Check Parcel" button stops returning data and the unlink is timestamped and logged.

### E4 — Parcel Check-Out (Bulk + Selective)

> Today this step is fully manual and there is **no identity check**: a resident states their room number, staff search the system to see what's waiting, physically pull the parcels, scan each one to match it against the record, hand it over, and the resident signs a paper logbook at the parcel room. That logbook stays exactly as it is — a separate, physical process outside this system. There is no digital signature anywhere in this product; the system's job at checkout is only to mark parcels collected and log who did it and when (LR-04), not to replace the logbook.

**US-12 — Bulk check-out for a room**
As staff, I want to check out every open parcel for a room in one action, so that a resident with multiple packages doesn't wait through repeated confirmations.
- Given a room has 3 open parcels, when staff search by the room number the resident states, then the system lists all open parcels for that room so staff know how many to physically pull before fetching them.
- Given staff scan each physical parcel's barcode while handing it over, when all scanned items match the room's open list, then they're marked collected together with one shared timestamp — staff then hand the parcels over and the resident signs the existing paper logbook as always; the system does not capture any signature.
- Staff can deselect/skip one item before confirming, leaving it open (routes to US-13).

**US-13 — Selective single-parcel check-out**
As staff, I want to check out one specific parcel while leaving others open, so that I can handle partial pickups or missing items correctly.
- Given multiple open parcels, when staff scan and confirm only one, only that one changes to "collected" once its barcode is matched at handover.
- Given a parcel is marked missing/unclaimed, a reason code is required and stored.

**US-15 — Room-mismatch double-check** *(soft warning, not a hard block)*
As staff, I want the resident's registered name/room shown clearly next to the parcel's recorded room before I hand it over, so that I have a chance to catch an obviously wrong room even without a formal ID check.
- The checkout screen shows the resident's registered name/room next to the parcel's recorded room, highlighted if they don't match, so staff can ask a quick "you're room 512, right?" before handing over.
- This is a visual double-check, not a hard block for now — since nothing stops a pickup at all today, even a dismissible warning is already an improvement over the current process.

### E5 — Legal & Compliance

**LR-01 — PDPA consent capture at onboarding**
As the team, we must get explicit, plain-language consent before storing any resident's name, room, or LINE ID, so the system has a lawful basis to hold that data.
- No personal field saves until consent is explicitly given via a plain-language notice (not buried in a policy).
- The system records who consented, the exact text/version shown, and when.

**LR-03 — Data minimisation**
As the team, we must collect and transmit only the personal data each feature actually needs.
- Any label photo captured for matching is deleted or blurred once intake is confirmed — never retained "in case."
- LINE status-check replies exclude any field not strictly needed to identify the parcel to its recipient (ties to US-10).

**LR-04 — Access & action audit log (≥90 days)**
As the team, we must log every login and every meaningful action (intake, match, override, checkout) with who/when/what, to satisfy Computer Crime Act §26.
- Every login (success or fail) and every state-changing action is logged with actor, action, timestamp, and affected record.
- Log entries are retained a **minimum** of 90 days — an auto-delete job that clears logs earlier is a violation, even if done to save storage.

**LR-05 — Verifiable record for consent actions**
As the team, every "I agree" tap or approval must record who, when, and exactly what text was shown, so it holds up under ETA §9. *(Parcel pickup itself has no digital signature — see the note at the top of Epic 4 — so this applies to consent actions only, not checkout.)*
- Ties into LR-01 (PDPA consent) and US-11 (staff issuing/reading out the OTP that links a LINE account to a room): each stores who acted, timestamp, method, and the exact terms version presented — never just `agreed = true`.

### E6 — AI Ethics & Human-in-the-Loop

> This build's only OCR/algorithmic-suggestion feature (US-03) is Should-Have and not yet built, and resident/room search (US-05) is plain-text lookup, not AI-ranked. This epic puts the human-in-the-loop safeguard in place ahead of time, so it's already enforced the moment an AI-suggestion feature does ship — deliberate scope discipline, not a gap: building OCR early just to give this epic something to guard would break the course's "exactly 1 core workflow" constraint.

**ET-01 — Human confirmation required for every AI suggestion**
As the team, any OCR read or algorithmic match suggestion must always require explicit staff confirmation before affecting a real record, so no resident is ever auto-assigned by an algorithm alone.
- A record only saves after a human accepts, edits, or rejects the suggestion — no "auto-apply above X% confidence" path exists.

**ET-04 — Graceful degradation when AI/external services fail**
As staff, I want to keep checking parcels in and out even if OCR or the LINE API is down, so a third-party outage never stops daily operations.
- If OCR is unreachable, photo capture automatically offers manual entry (US-02) with no loss of intake capability.
- If LINE's API is unreachable, check-in still succeeds; OTP issuance and status-check replies simply report "try again later" rather than blocking the workflow.

---

## 4. Recommended Sprint-0 scope

All 16 stories above are Must Have and form one traceable chain: **scan → match → link/check → checkout**, with the legal/ethics duties attached at the exact step they apply (LR-05 lives inside US-11, LR-03 lives inside US-01/US-10, ET-01 stands ready for whenever an AI-suggestion feature ships). This is the slice to build first.

## 5. Deferred — not detailed yet (title only, pull into a future sprint when needed)

Grouped by why they're waiting, not by ID order — nothing here is dropped, just not expanded into full stories yet.

**Future epic — Staff Operations Console** *(Must Have for the product long-term — but it's UX/NFR polish on top of the core workflow, not the workflow itself, so it waits)*
- US-16–19 — live dashboard, fast search, low-training UI, peak-load performance. Once built, it should include a **problem-parcel bottleneck view**: counts and quick access by US-06's reason category (No match / No resident / Ambiguous / Other) across all buildings, so a supervisor can see where things are stuck without paging through each building one by one.

**Future epic — Multi-Building Administration** *(Should Have / Could Have — only matters once more than one building is actually live)*
- US-20–22 — cross-building volume reporting, role-based staff access per building, aging-parcel escalation.

**Should-Have polish on the core workflow**
- US-03 — OCR-assisted label capture (upgrade to US-02, once manual entry is stable).
- US-04 — Duplicate/re-delivery detection.
- US-07 — Resident self-service profile correction.
- US-09 — Delivery-failure fallback / retry UI for staff.
- US-14 — Proxy pickup with recorded consent.

**Owed but not urgent**
- LR-02 — PDPA access/correction/deletion self-service. The underlying legal duty is already met today, not just promised for later: `rule.md` documents a working manual channel — a resident's access/correction/deletion request routes to the PO by email and is logged like any other action (ties to LR-04's audit trail). What's deferred as Could-Have polish is only the in-app self-service *screen*, once volume justifies building it.
- ET-02 — Audit trail distinguishing AI-suggested vs. manually-entered data.
- ET-03 — Explainable AI suggestions (show *why* a match or OCR read was suggested) — relevant once US-03 (OCR) or a future matching feature ships.
- Self-service scan-your-own-QR checkout at pickup — raised by one resident in interviews (see `survey_interview_analysis.md` §1); considered and not adopted for this build because it contradicts the current design where staff physically pull and hand over every parcel. Kept as a future-version idea only.
