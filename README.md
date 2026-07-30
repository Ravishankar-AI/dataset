# Objectways Data

Next.js scaffold for the robotics dataset catalog: **one dataset registry, three
access-level doors** (Samples / Uploads / Datasets) over the NAS → R2 pipeline.

## Architecture recap

- **NAS** — internal, push-only capture staging (not modeled in this app; the
  ingestion worker that reads from it is a separate service).
- **R2** — object storage for both public sample clips and licensed customer
  datasets. Downloads are signed URLs straight from R2 (`src/lib/r2.ts`) —
  the app server never proxies file bytes.
- **One Postgres-shaped catalog** (`prisma/schema.prisma`) — `Dataset`,
  `Episode`, `Modality`, `Organization`, `Entitlement`. Samples, Uploads, and
  Datasets are access-tier filters over this same registry
  (`src/lib/catalog.ts`), not separate systems.

## Doors → routes

| Door | Route | Who | Gate |
| --- | --- | --- | --- |
| Samples | `/samples` | Public | none |
| Uploads | `/uploads` | Staff | `role: contributor \| admin` |
| Datasets | `/datasets` | Customer orgs | `role: customer` + org entitlement, or `admin` |

## Getting started

```bash
npm install
cp .env.example .env
npm run db:migrate   # creates prisma/dev.db (SQLite) and applies the schema
npm run db:seed      # seeds modalities, sample/customer datasets, episodes, demo users
npm run dev
```

Visit `/sign-in` and pick one of the seeded personas (admin, contributor, or an
Acme Robotics customer) to see each door render under its role.

## What's stubbed, and how to un-stub it

This is a design-to-code scaffold, not wired to live infrastructure yet:

- **Auth** (`src/lib/auth.ts`) — a mock cookie-based session, not a real IdP.
  Replace `getSession()`'s cookie read with a Clerk or Supabase Auth session
  lookup (per the architecture memo) and delete `src/app/sign-in/*`. Keep the
  `Session` type shape (`role`, `organizationId`) — the rest of the app reads
  from that, not from cookies directly.
- **Database** (`prisma/schema.prisma`) — SQLite locally for a zero-dependency
  setup. For production, change `datasource db { provider = "postgresql" }`
  and point `DATABASE_URL` at managed Postgres (Neon/Supabase). No SQLite-only
  features are used, so this is a one-line change plus a fresh migration.
- **R2** (`src/lib/r2.ts`) — real signed URLs once `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are set. Without them, it
  falls back to `/placeholder-download` so every page stays clickable in dev.
- **Ingestion worker** — not part of this repo. `/uploads` reads whatever is
  already in the `Episode` table; the worker that validates, anonymizes, and
  writes those rows from NAS captures is a separate service to build next.

## Design system

Visual tokens live as CSS variables in `src/app/globals.css` (mirrored into
`tailwind.config.ts`) — mono UI type, bold display headlines, a single indigo
accent, light/dark via `prefers-color-scheme` and `data-theme`. This mirrors
the approved homepage mockup; components are in `src/components/`.

## Known issue

`npm audit` still flags high-severity advisories nested inside Next.js's own
bundled `postcss`/`sharp` (image optimization) dependencies on the latest
stable Next.js release (16.2.12) as of this writing. `npm audit fix --force`
"resolves" this by downgrading to `next@9.3.3`, which reintroduces far worse,
already-patched vulnerabilities — left on latest stable instead, pending an
upstream fix.
