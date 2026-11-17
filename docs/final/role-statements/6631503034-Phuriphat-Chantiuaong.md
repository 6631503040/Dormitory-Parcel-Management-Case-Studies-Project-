# Role Statement — Phuriphat Chantiuaong (6631503034)

**Role:** UX/UI Designer · JOBAS Company #21 · DPMS

## What I owned

I owned the user experience and visual design of the staff desk and the resident page. I built the first React/Tailwind prototype of the parcel workflow: login, dashboard, check-in/check-out modals and the archive. I then refined it into a consistent design system: design tokens in CSS custom properties, a single Thai/Latin font (Anuphan) and a fixed type scale. I also made the interface more accessible. Every coloured status now carries an icon and a text label, and the focus ring contrast went from 1.73:1 to 4.63:1 to meet WCAG. Later I redesigned the resident notification page to match the staff desk. I also improved check-out with room search and a clearer way to show problem parcels. I recorded these design decisions in `DESIGN.md` and `PRODUCT.md`.

## Evidence

- Initial prototype: [a28e5be](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/a28e5be7ac9d46b63a01ea13179d7a412fbf2d0b)
- UI flow + session persistence: [ec63ada](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/ec63ada3bdecf691156e64c796dff352588009f3)
- Design system and accessibility pass: [f6b702f](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/f6b702fdfcdd98b481911af358a65c39496a30b1)
- Resident page redesign: [c261475](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/c2614759b072f2fb144d6d63978f336404c95b70)
- Check-Out room search: [5da15cc](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/5da15ccb67514cae56fe7f91f0caed7c947ab852)
- Design records: [DESIGN.md](../../../DESIGN.md), [PRODUCT.md](../../../PRODUCT.md)

## AI disclosure

I used Claude (Claude Code) to help write and refactor UI code, and the Impeccable design skill to critique the interface. Claude is credited as co-author on the relevant commits. I reviewed, tested and approved every change myself, and all design decisions are mine. Claude also helped draft this statement, and I checked it for accuracy.

## Reflection

**1. Lessons learned.** Building DPMS with AI changed every stage, not only coding. **Better:** design iteration became much faster. With Claude Code I could turn an idea into a working React screen in an hour, try it in the browser, and throw it away if it was wrong. That is how I finished the accessibility pass (focus ring contrast 1.73:1 → 4.63:1, an icon and a label on every status) and the resident page redesign in days, not weeks. Testing also got stronger: every fix from the QA review came with a regression test that failed before the fix and passed after it.

**Worse:** requirements discipline. My first AI-assisted prototype looked finished, but the 4 Sep review found it was "a different product" from the locked design spec. It used free-text room numbers instead of directory validation and added features nobody asked for, such as a notification bell and a Line ID field. The AI built whatever I described, so it was easy to drift from the spec without noticing. It also gave the UI a generic "AI look" that I had to remove in the 5 Oct refresh. My lesson: AI makes code cheap, so the spec, the review and the human decisions become the important part. For teamwork, this meant we had to review each other's AI-written pull requests carefully instead of just merging them.

**2. Where I stand.** I am a junior UX/UI designer who can also ship front-end code. AI removed much of the wall between design and development, so I can test my designs in a real app. But it also means "I can make a screen" is no longer special. My value is judgement: understanding the user (a busy desk staff member during a Flash Sale), saying no to features, and checking accessibility and quality.

**3. My plan.** Next year: finish my degree, do an internship as a UX/UI or front-end developer, and build a portfolio of real case studies like this one, including user research and usability testing. In 5 years: a product designer who leads design for a product team, using AI every day but owning the research and the design decisions.
