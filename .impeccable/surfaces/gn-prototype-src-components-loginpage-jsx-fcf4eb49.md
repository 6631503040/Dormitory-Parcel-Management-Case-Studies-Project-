---
version: 1
slug: "gn-prototype-src-components-loginpage-jsx-fcf4eb49"
primary_target: "docs/02-design/prototype/src/components/LoginPage.jsx"
related_targets: ["docs/02-design/prototype/src/styles.css"]
---

# Login surface

Mode: Operate. Scope: LoginPage.jsx and login-only CSS. Audience: dormitory front-desk staff entering ParcelHub. Keep existing frontend sign-in callback and all backend files untouched. User pins the supplied split-screen reference: white form at left, generated minimal cartoon dormitory image with subtle 3D at right. Existing ParcelHub identity and Thai field copy carry forward. Build path: code, per project config. No concept roll or approval comp needed for this pinned layout.

## Direction contract

THESIS: A familiar, uncluttered sign-in screen grounded in the dormitory it serves; replace the isolated centered form with the user's split composition.
OWN-WORLD: Existing blue ParcelHub mark, neutral Thai UI typography and white form surface; a powder-blue field with three matching matte cartoon dormitories provides the only large color field.
STORY: Staff recognize ParcelHub, enter username/password, optionally reveal their password, and submit; actionable errors preserve entered values.
FIRST VIEWPORT: Full-height 44/56 split on desktop; brand at upper left, a 360px form centered in the left panel, complete labeled fields and full-width primary button. Right panel is a single minimal cartoon image with ample breathing space around the full dormitory group. Below 760px, prioritize the form without decorative image or horizontal scrolling.
FORM: User-pinned reference, seed key not applicable. Signature: simplified cartoon dormitory architecture beside the counter's sign-in, no floating cards, metrics or instructional blocks. Keyboard focus remains familiar.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Quality bar

Follow the reference's clean asymmetry and generous spacing, with readable Thai text, accessible native fields, 44px controls, clear error focus, and mobile/short viewport resilience. Image is generated illustration, not evidence of an actual property. No unsupported recovery link, claims, or changed authentication behavior. Required captures: desktop 1440×900, mobile 390×844, short mobile 390×480.

## User revision — 2026-10-06

The user rejected the first realistic architectural image as too AI-like. Replace only the illustration with minimal cartoon geometry and gentle 3D depth: simple white dormitory, blue windows/rails, two simplified shrubs on powder blue. No photographic materials, detailed scenery, people, or floating UI. Keep the form and split layout. Current asset: public/images/dormitory-login-minimal.webp; full prompt: .impeccable/assets/dormitory-login-minimal.json. The generated image is a decorative illustration, not an actual dormitory property.

## Campus image revision — 2026-10-06

User asks for several instances of the existing model, layered like the supplied complex reference. Current art is three matching three-storey cartoon dormitories at staggered depths around a sparse courtyard and lawn. Preserve the model palette, matte material, gentle 3D and uncluttered background. Use contained, centered fitting to keep the complete group visible on desktop/tablet. Form/layout/auth remain unchanged; mobile still hides the illustration. Current asset: public/images/dormitory-login-campus.webp; full prompt and references: .impeccable/assets/dormitory-login-campus.json. Prior single-building model is preserved at .impeccable/assets/dormitory-login-minimal.webp as a development reference, not a shipping asset. Required current captures: 1440×900 desktop, 900×900 tablet and390×844 mobile; prior short form evidence remains applicable since the image is hidden there.
