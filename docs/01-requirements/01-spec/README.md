# docs/01-requirements/01-spec/

One file per requirement or small feature. This is the detailed layer under
`../backlog.md` (the backlog holds the one-line index; the spec holds the full story,
acceptance criteria, data, screens, and compliance notes).

## File naming

```
{YYYYMMDD}-{no}-{topic}.md
```

- `{YYYYMMDD}` — date the spec was first written (e.g. `20260904`)
- `{no}` — sequence number for that date, starting at `01`
- `{topic}` — short kebab-case subject (e.g. `checkin-room-validation`)

Example: `20260904-02-checkout-bulk.md`

## Rules

- Use `_template.md`.
- One requirement ID per file (`FR-<n>`, `NFR-<n>`, or `CON-<n>`). Never renumber; deprecate instead.
- Terminology must match `docs/02-design/design-spec.md` §1 exactly.
- Every file must have a matching row in `../backlog.md`, and vice versa.
- Create these with the `requirement-writer` agent or the `/capture-requirement` skill so the conventions stay consistent.
