# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Authority

The user confirmed on 2026-10-05 that `docs/02-design/design-spec.md` (LOCKED, version 1.1) is the primary authority for product scope. This record summarizes product context; it does not replace that specification. The broader LINE notification and unmatched-parcel queue scope in `docs/02-design/spec.md` is not confirmed for this build.

## Users

Primary users are dormitory front-desk Staff who record incoming Parcels, find Pending Parcels, and perform Check-Out. Residents collect their Parcels; resident self-service is not part of the confirmed scope.

## Product Purpose

Dormitory Parcel Management System replaces the desk's Google Forms/Google Sheets workflow with a dedicated web application. It aims to reduce identification errors and repetitive entry, make Pending Parcels easy to find, and preserve a traceable history of Check-In and Check-Out.

## Operating Context

Staff work at a dormitory counter, including busy Flash Sale periods. Repository research reports roughly 418 incoming and 418 outgoing Parcels per day, with peaks around 1,024 Parcels/day; these are reported operating volumes, not demonstrated application capacity.

The core workflow is: scan or enter a Tracking Code → select a directory-validated Room Number → Check-In → search Pending Parcels for collection → Check Out All or Check Out Selected → retain Parcel History. Physical storage-location tracking was removed from scope.

## Capabilities and Constraints

Confirmed target scope:

- Check-In with Tracking Code entry/scanning and Room Number validation against the Resident Directory.
- Check-Out with both Check Out All and Check Out Selected available.
- Search by Room Number, Tracking Code, or Resident name.
- Daily Dashboard showing Checked In, Picked Up, and Pending counts.
- Read-only Resident Directory and Parcel Detail with append-only Parcel History.
- Staff sign-in and server-enforced role-based access; every Check-In/Check-Out records Staff identity and timestamp.

The established stack is React with Vite and Tailwind CSS → Go/Gin API → PostgreSQL, with Docker/docker-compose planned for deployment. The existing implementation at `docs/02-design/prototype/` is a frontend demo, not a completed production system. Its React state is temporary, its sign-in is demonstrative, and its screens and behavior do not establish a change to the locked scope.

Room Number selection must use directory validation rather than free-text entry; the server must revalidate it. The target system requires an online connection for validation and audit recording. Parcel records are archived rather than hard-deleted. Store timestamps in UTC and display them in Asia/Bangkok local time.

Out of scope: physical storage-location tracking, handwriting OCR, native mobile apps, direct courier API integration, and resident self-service Check-Out. LINE notifications and an unmatched-parcel queue require a separate scope decision before implementation.

Open decisions: the precise post-pickup archival window and any future expansion beyond the locked scope. Planned security, compliance, deployment, and performance requirements must not be represented as implemented or verified solely because they appear in project documentation.

## Brand Commitments

Display name: Dormitory Parcel Management System. Short name: Parcel Desk. Preserve the locked terminology and user-facing strings in `docs/02-design/design-spec.md`. The specified v1 language is English, with strings centralized for later localization. Preserve the documented commitment to familiar Google Sheets/Forms workflows so Staff need little retraining; visual details remain in the existing design specification.

## Evidence on Hand

- `docs/02-design/design-spec.md`: confirmed product scope, terminology, screens, data model, architecture, and constraints.
- `docs/02-design/user_journey.md`: Staff and Resident workflows.
- `docs/05-log/20260904-remove-storage-location.md`: removal of physical storage tracking.
- `docs/02-design/survey_interview_analysis.md`: repository research findings; distinguish observations from product claims.
- `docs/02-design/prototype/` and `README.md`: current demo and its documented limitations.

Use synthetic Resident/Parcel data for development. Do not invent customer endorsements, production deployment evidence, or measured performance results.

## Product Principles

- Prevent identification mistakes at Check-In through directory validation.
- Keep frequent counter tasks fast with scanning, keyboard access, and minimal repeated entry.
- Keep bulk and selective Check-Out available without losing per-Parcel traceability.
- Preserve Staff identity and timestamps in append-only Parcel History.
- Distinguish the confirmed target product from the capabilities of the current demo.

## Accessibility & Inclusion

Support Staff with varying technical proficiency under counter and peak-hour pressure. Preserve keyboard navigation, clear focus, readable contrast, and low-typing workflows. No product-specific WCAG conformance claim has been established.
