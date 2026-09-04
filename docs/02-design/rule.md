Dormitory Parcel Management System (DPMS) — Legal & Compliance Rules for AI Agents
# rule.md — DPMS legal rules
**Company name:** JOBAS Company
Read this before writing any code that touches user data or user actions. Rules are written as `If the system ___, it must ___` so an agent can act on them directly — see product_backlog.md Epic E5 (LR-01–LR-05) for the user stories these rules back.

## PDPA (Personal Data Protection Act)
What it is: A data privacy law requiring us to get explicit permission before collecting data, use it only for stated purposes, and provide users with the ability to manage or delete their own information.
What it requires: consent · purpose limit · minimise · access/correct/delete · sensitive data
Rules for the agent:
- If the system stores a resident's name, room number, or LINE ID, it must first show a plain-language consent notice and record who consented, the exact text/version shown, and when — no personal field saves before consent exists. (LR-01)
- If the system captures a label photo for OCR/matching, it must delete or blur that photo once intake is confirmed — never retained "in case." (LR-03)
- If the system sends a LINE notification, it must include only building, room, and a system-generated parcel reference — never courier/company identity, another resident's name, or a payment/CoD amount. (LR-03, ties to US-10)
- If the system stores a parcel record, it must keep it only as long as operationally necessary (e.g. a defined number of months after pickup), then archive or delete it — no indefinite retention.
- If a resident asks to see, correct, or delete their stored data, the system must provide a way to act on that request (v1: route to the PO by email; a self-service flow is tracked as LR-02, currently deferred — not yet built).
- If the system uses synthetic/mock data for development or testing (see the Data Risk below), it must never contain a real resident's name, room, or contact detail — synthetic data must be generated, not copied or derived from real records.

## Computer Crime Act §26
What it is: A cybersecurity law requiring service providers to retain system access and traffic logs for at least 90 days to ensure user actions can be traced during an investigation.
What it requires: keep an access/traffic log ≥90 days, tied to a real user
Rules for the agent:
- If the system has a login, it must log every attempt — success or fail — with actor, timestamp, and outcome.
- If the system performs intake, match/override, LINE-link confirmation, or checkout, it must log that action with actor, action, timestamp, and the affected record. (LR-04)
- If a scheduled job clears old data, it must never delete access/action log entries younger than 90 days, even to save storage — this applies regardless of how the parcel-record retention rule above is implemented.

## Electronic Transactions Act §9 / 26 / 28
What it is: A law that validates online transactions and agreements (like clicking an "I agree" button) as legally binding, provided the system captures reliable digital evidence of the action.
What it requires: valid e-signature test (§9) · presumed-reliable signature (§26) · CA duties (§28)
Rules for the agent:
- If a resident gives PDPA consent (e.g., when adding the dorm's LINE account), the system must record who consented, the exact text/version shown, and a timestamp — never just `consented = true`. (LR-01, LR-05)
- If staff confirm a resident's LINE link, the system must record which staff member confirmed it, when, and the exact terms the resident was shown — before any notification is sent. (LR-05, ties to US-11)
- The system must **not** treat parcel checkout as an e-signature event — pickup confirmation stays the existing paper logbook, outside the system entirely (see product_backlog.md Epic E4 note). Do not build digital-signature capture anywhere in checkout.
- The system must **not** operate its own Certificate Authority — no §28 duties apply, since the product never self-issues signing certificates.

---
**Status:** Derived directly from the LR stories in `product_backlog.md` Epic E5. Team should read through once before submitting — flag anything here that disagrees with how the build actually works.
