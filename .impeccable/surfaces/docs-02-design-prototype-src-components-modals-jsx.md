---
version: 1
slug: "docs-02-design-prototype-src-components-modals-jsx"
primary_target: "docs/02-design/prototype/src/components/Modals.jsx"
related_targets: ["docs/02-design/prototype/src/styles.css"]
---

# Scan-first checkout — 2026-10-06

MODE: Operate
THESIS: Staff scan the parcel in hand, inspect its identity, then explicitly confirm pickup.
OWN-WORLD: Inherit ParcelHub's restrained counter interface, Thai type, white surfaces, soft blue checkout tokens and native controls.
STORY: Open checkout → scan barcode or type the complete tracking code → Enter or ค้นหาพัสดุ → inspect matching parcel → ยืนยันนำพัสดุออก.
FIRST VIEWPORT: A compact viewport-centered named dialog with one labeled scanner field, existing icon-only scanner focus control and explicit manual lookup button. No room lookup, initial list or instructional disclosure. No checkout action until a parcel is found.
FORM: User-pinned functional revision inside an existing surface; no concept seed or approved comp. Preserve intake, Dashboard/Archive pagination, authentication, data callback and backend.
QUALITY BAR: Exact full-code lookup independently resolves room; parcel result shows tracking code, status, room, recipient, quantity, Bangkok receipt date and damage reason when applicable. Enter only looks up; it never commits pickup. Edited/unverified codes block confirmation. Empty, unknown, duplicate and already-out codes produce associated input errors. One primary confirmation remains explicit. Optional same-room additions are collapsed, paginated and checkbox-based; selecting all multiple records needs room/count confirmation. Errors preserve the prepared selection; busy state prevents repeat commit. Native dialog restores focus, supports Escape and contains controls; short screens use a single content scroller with anchored footer. No actual scanner, touch device or screen-reader certification is implied.
FINISH: Bounded desktop/mobile/short-mobile QA with synthetic records; required evidence paths are the initial/result desktop/mobile, optional bulk desktop and short-mobile captures under .impeccable/review/checkout-scan-*-20261006.jpg. Build and existing/new checkout validation tests must pass. Fresh finish review and scoped documentation handoff complete the work.

PLACEMENT FOLLOW-UP: User requested both-axis viewport centering after the original flow review. Initial/result dialogs use auto margins with max-height 100dvh minus32px; short-screen content scrolling and anchored footer remain. Targeted evidence: checkout-centered-desktop-20261006.jpg and checkout-centered-mobile-20261006.jpg under .impeccable/review/.
