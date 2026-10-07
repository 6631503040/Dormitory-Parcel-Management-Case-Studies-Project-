# Frontend UX/UI refinement — 2026-10-05

Branch: `codex/frontend-ux-ui-refresh` (created before UI edits).

The user asked to reduce the AI-pattern appearance and limit work to frontend UX/UI. Review identified decorative dots and login shapes, a display/body font pairing with inconsistent Thai rendering, oversized controls, repeated rounded containers, competing color blocks, and duplicated damaged-parcel rows.

## Changes

- Retain ParcelHub, Dashboard/Archive navigation, existing data, and Check-In/Check-Out flows.
- Remove decorative backgrounds, icon tiles, eyebrow labels, and pill navigation/status containers.
- Use one Thai-capable type family, shared CSS color properties, darker readable action/error colors, and compact consistent controls.
- Make the parcel table the main workspace, with labelled search, clear-query action, inline result feedback, and progressively disclosed damage entries.
- Apply the same visual language to Archive, Login, notifications, and dialogs.
- Add focus indicators, input label associations, accessible icon names, active/selected states, announced feedback, and native modal dialog behavior.
- Add a persistent selected-parcel summary to Check-Out so selections outside the current filter remain visible.
- Constrain dialogs to dynamic viewport height, retain internal table scrolling, and keep mobile actions reachable.
- Merge current UI tokens/documentation into DESIGN.md and its sidecar. Locked design-spec.md and PRODUCT.md are unchanged.

## Verification

- Production build passed; whitespace/error check passed.
- Browser layout inspection: desktop 1440×900, mobile 390×844, short viewport 390×480.
- At the short viewport, expanded Check-In fits from y=16 to y=464 and scrolls internally.
- Escape closes the dialog and returns focus to the opener. Native dialog provides modal focus containment; initial focus goes to the first field.
- Dashboard room search, clear-query/empty results, Archive filters, damage disclosure, notification dismissal, and Login validation were exercised.
- Check-Out selections remained visible in the summary after changing to a different room filter. No parcel transaction was saved during testing.
- Screenshot evidence is stored in `.impeccable/review/desktop.jpg` and `mobile.jpg`.
- The design hook's new-font finding was addressed by recording the intentional Thai font in DESIGN.md; no detector ignore was added.

## Boundaries

Only frontend source and supporting design records were changed. Backend files, data model, parcel sample data, persistence handlers, authentication mechanism, damage/LINE mutation logic, room validation, and timezone formatting are unchanged.

This is a visual/interaction refinement, not resolution of the entire earlier audit. Physical touch, a real mobile keyboard, screen readers, and large-data performance were not tested. Mobile tables continue to scroll horizontally inside the register.
