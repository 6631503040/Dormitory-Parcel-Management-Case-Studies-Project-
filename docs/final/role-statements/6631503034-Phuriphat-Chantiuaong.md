# Role Statement — Phuriphat Chantiuaong (6631503034)

**Role:** UX/UI Designer · JOBAS Company #21 · DPMS

## What I owned

I owned the user experience and visual design of the staff desk and the resident page. I built the first React/Tailwind prototype of the parcel workflow: login, dashboard, check-in/check-out modals and the archive. I then refined it into a consistent design system: design tokens in CSS custom properties, a single Thai/Latin font (Anuphan) and a fixed type scale. I also made the interface more accessible. Every coloured status now carries an icon and a text label, and the focus ring contrast went from 1.73:1 to 4.63:1 to meet WCAG. Later I redesigned the resident notification page to match the staff desk. I also improved check-out with room search and a clearer way to show problem parcels. I recorded these design decisions in `DESIGN.md` and `PRODUCT.md`.

I also went to Baansoi5 Dormitory from 2 to 5 November 2026 to collect user acceptance test (UAT) results from real users: 5 staff and 5 residents. Each participant did the same tasks with the new system and with their existing method (Google Forms/Sheets, or asking at the desk). We timed every task, noted errors and observations, and collected SUS and TAM questionnaires after each session. Both groups rated usability above average (SUS 77.5 for staff and 76.5 for residents; 68 is average). The new system was much faster for finding who collected a parcel (−90%) and for residents seeing that a parcel was picked up (−68%). The sessions also found six defects. The most serious one was that check-out had no room number search, which I fixed in `5da15cc`. Staff U03–U05 then completed the check-out tasks with 0 errors.

## Evidence

- Initial prototype: [a28e5be](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/a28e5be7ac9d46b63a01ea13179d7a412fbf2d0b)
- UI flow + session persistence: [ec63ada](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/ec63ada3bdecf691156e64c796dff352588009f3)
- Design system and accessibility pass: [f6b702f](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/f6b702fdfcdd98b481911af358a65c39496a30b1)
- Resident page redesign: [c261475](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/c2614759b072f2fb144d6d63978f336404c95b70)
- Check-Out room search: [5da15cc](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/5da15ccb67514cae56fe7f91f0caed7c947ab852)
- UAT round 1 results with real users: [docs/03-test/results/20261102-uat/README.md](../../03-test/results/20261102-uat/README.md)
- Design records: [DESIGN.md](../../../DESIGN.md), [PRODUCT.md](../../../PRODUCT.md)

## AI disclosure

I used Claude (Claude Code) to help write and refactor UI code, and the Impeccable design skill to critique the interface. Claude is credited as co-author on the relevant commits. I reviewed, tested and approved every change myself, and all design decisions are mine. Claude also helped draft this statement, and I checked it for accuracy.

