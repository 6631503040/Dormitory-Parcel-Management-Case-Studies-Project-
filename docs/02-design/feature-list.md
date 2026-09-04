# feature-list.md — SDPMS (Week 4 design deliverable)

Grouped from `product_backlog.md` (16 Must-Have stories) per `spec.md`. One core feature marked — pick it because it kills the #1 charter pain (identification failures) and everything downstream (matching, notification, checkout) depends on getting the room/resident right at intake.

- **Parcel check-in with room/resident validation** (scan or manual tracking # → directory lookup, not free-text) ← **core**
- Unmatched-parcel review queue (tagged by reason: No match / No resident / Ambiguous / Other)
- Real-time LINE notification (opt-in, staff-confirmed link only)
- Parcel check-out (bulk for a room, or selective single-parcel)
- Room-mismatch double-check at handover (soft warning, not a block)
- Legal & compliance (PDPA consent, ≥90-day access log, verifiable consent records)
- AI-ethics safeguards (human confirms every match suggestion; works even if OCR/LINE is down)

**Resolved — core feature is check-in with validation.** Checkout also traces cleanly to a charter pain and has the clearer before/after metric, but check-in is upstream of everything: a resident/room mismatch at intake corrupts matching, notification, and checkout all at once, while a checkout-only fix can't repair bad data injected earlier. Charter pain #1 (identification failures) is also the headline pain, ranked above system inefficiency and slow checkout. Lock the user-journey and diagrams to this thread.
