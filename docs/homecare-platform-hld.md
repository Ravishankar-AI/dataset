# Homecare Platform for India — High-Level Design (v0.1 draft)

Status: for validation, nothing built yet.

Full interactive version: https://claude.ai/code/artifact/249a68f4-6af6-45c0-a2f4-20c95a53084e

## Context

A clinician-led homecare platform for India: a SaaS back office plus mobile
apps for caregivers and families, modelled on the care-planning discipline of
platforms like [Nourish Care](https://nourishcare.com/) and adapted for how
care is actually delivered and paid for in India — inconsistent connectivity
in the field, WhatsApp as the family's default channel, and a doctor acting
as the clinical anchor rather than just an auditor.

## Personas

| Role | Who | What they do |
| --- | --- | --- |
| Clinical director | The doctor | Owns treatment plans, reviews daily flags, signs off monthly assessments, approves hospital transfers |
| Care coordinator | Ops lead | Scheduling, chasing missed visits, onboarding paperwork |
| Field staff | Nurse / caregiver | Logs visits, vitals, medication, wounds, incidents — mobile, offline-first |
| Service partner | Lab / hospital | Receives orders, uploads results, receives transfer summaries |
| Circle of care | Guardian / family | Read-only monitoring + WhatsApp/push alerts |
| Optional | Patient | Simplified view of their own plan, where capable |

## Product surfaces

- **Care Ops Console** — Next.js (React) web app for doctor/coordinator/admin workflows.
- **Field App (Care mode)** — React Native, offline-first, for nurses/caregivers.
- **Circle of Care App (Family mode)** — React Native, same codebase as the field app, gated by role, for guardians.

## Patient journey

Enquiry & intake → Pre-assessment → Care plan & consent sign-off → Active
care (daily visits & monitoring) ⟲ Periodic review (monthly assessments) →
Hospital transfer or planned discharge → Outgoing summary & records handover.

## Core modules (MVP / Phase 2 / Phase 3)

| Module | Phase |
| --- | --- |
| Patient profile & Circle of Care | MVP |
| Care plan builder | MVP |
| Daily monitoring & eMAR | MVP |
| Body map & incidents | MVP |
| Documents | MVP |
| Alerts & escalation (basic) | MVP |
| Compliance & audit trail | MVP |
| Assessments & risk scoring (falls, pressure sore, PEEP, nutrition, medication adherence) | Phase 2 |
| Lab orders, hospital transfer/referral workflow (full) | Phase 2 |
| Workforce & scheduling | Phase 2 |
| WhatsApp notifications | Phase 2 |
| Billing & care packages | Phase 3 |
| Analytics dashboard | Phase 3 |
| Multi-branch support | Phase 3 |

## Architecture

```
Clients: Care Ops Console (React/Next.js) · Field App (React Native, offline-first) · Circle of Care App (React Native)
   -> Core API (NestJS, REST) on Railway
        -> PostgreSQL (Railway)
        -> Object storage (S3-compatible: R2 or AWS S3, ap-south-1) for reports/photos/docs
        -> Job queue (BullMQ + Redis) -> Risk & alert engine -> Push (FCM/APNs), WhatsApp Business API, SMS gateway
```

The field app writes to a local store first (SQLite/WatermelonDB) and syncs
in the background; every other client talks to the API directly online.

## Data model (simplified)

```
Organization -> Branch -> Patient -> Guardian (many-to-many)
Patient -> Care plan -> Care domain (mobility, nutrition, skin, meds, ...)
Patient -> Visit log -> Vital reading / Medication given / Body map entry / Incident report
Patient -> Assessment -> Risk score + trend -> Alert / escalation
Patient -> Lab order/result, Hospital transfer/referral, Document
Organization -> Staff (role: doctor, coordinator, nurse, lab)
```

## Technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| Web dashboard | Next.js + TypeScript, Tailwind | Matches this repo's existing scaffold |
| Mobile apps | React Native + Expo | One team, one language, across web and mobile |
| Offline store (mobile) | WatermelonDB or SQLite + sync layer | Visit logging must work with zero signal |
| Backend API | NestJS (Node/TypeScript), REST | Shared service layer for both clients; central home for permissions and risk-scoring logic |
| Database | PostgreSQL on Railway, via Prisma | As requested; Prisma already used in this codebase |
| File storage | S3-compatible (Cloudflare R2 or AWS S3, ap-south-1) | Railway has no native object storage; this org's existing MinIO/NAS pattern is a viable self-hosted alternative |
| Background jobs | BullMQ + Redis (Railway Redis add-on) | Reminders, escalation checks, assessment due-dates |
| Auth | Clerk, or self-hosted Auth.js against the same Postgres | Role-based access with organization scoping |
| Notifications | FCM/APNs, WhatsApp Business API (Gupshup/Interakt), MSG91 SMS fallback | WhatsApp is the family's default channel in India |
| Observability | Sentry + Better Stack/Logtail | Clinical software should not fail silently |

## Security & compliance

- **DPDP Act, 2023** — explicit consent at onboarding, purpose-limited use, right-to-erasure path, breach-notification process from day one.
- Encryption in transit and at rest; signed, short-lived URLs for document downloads.
- Append-only audit trail on every clinical write (who/when/what).
- Data residency in an India region for both database and object storage.
- Audit-trail and consent design leaves room to pursue NABH home healthcare accreditation later if desired.

## Rollout roadmap

1. **Phase 1 (~8–10 weeks)** — patient profiles, care plan builder, guardian linking, field app (visit check-in/out, vitals, eMAR, notes, photos, offline-first), document uploads, basic alerts, guardian read-only view + push.
2. **Phase 2 (~6–8 weeks)** — monthly assessments with scoring/risk bands, lab order & hospital transfer workflow, WhatsApp notifications, staff scheduling.
3. **Phase 3 (ongoing)** — billing/care packages, analytics dashboard, multi-branch support, lab/pharmacy integrations.

## Open questions before building

1. One agency today, or multi-branch/franchise from day one?
2. Should this repository (`ravishankar-ai/dataset`, currently an unrelated robotics dataset catalog scaffold) become the homecare platform, or should the platform live in a new repo?
3. Is billing/invoicing needed at MVP, or can families be invoiced manually at first?
4. Do you already use specific assessment tools (e.g. Barthel Index, Waterlow, MUST), or should Phase 2 ship with generic, configurable scoring templates?
