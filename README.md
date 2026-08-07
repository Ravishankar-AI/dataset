# Objectways Data

Next.js scaffold for the robotics dataset catalog: **one dataset registry, three
access-level doors** (Samples / Uploads / Datasets) over the NAS → MinIO pipeline.

## Architecture recap

- **NAS** — internal, push-only capture staging (not modeled in this app; the
  ingestion worker that reads from it is a separate service). It never talks
  to this app directly or gets exposed to the internet.
- **MinIO** — self-hosted, S3-compatible object storage running against the
  NAS's own disks (not a cloud provider — avoids cloud storage/egress
  billing) for both public sample clips and licensed customer datasets.
  Downloads are signed URLs straight from MinIO (`src/lib/storage.ts`) — the
  app server never proxies file bytes.
- **One Postgres-shaped catalog** (`prisma/schema.prisma`) — `Dataset`,
  `Episode`, `Modality`, `Organization`, `Entitlement`. Samples, Uploads, and
  Datasets are access-tier filters over this same registry
  (`src/lib/catalog.ts`), not separate systems.

## Doors → routes

| Door | Route | Who | Gate |
| --- | --- | --- | --- |
| Samples | `/samples` | Any registered account | signed in (any role) |
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

Visit `/` and either **Register** a new account (lands on `/samples`) or
**Sign in** with one of the seeded demo accounts — `ravi@objectways.com`
(admin), `capture-team@objectways.com` (contributor), or
`ml-lead@acme-robotics.example` (customer) — all using the password
`password123`.

## Deploying to Railway

`railway.json` sets a `preDeployCommand` of `npx prisma migrate deploy`, so
Postgres migrations apply automatically before each new deploy goes live —
no manual step needed after a schema change. Railway doesn't reliably
auto-detect this file for services created via the API; if a deploy skips
migrations, set the same value directly on the service (Settings → Deploy →
Pre-Deploy Command).

1. **New project** → Deploy from GitHub repo → pick this repo/branch.
   Railway auto-detects Node.
2. **Variables** — copy every key from `.env.example` into the service's
   Variables tab, pointed at the real Supabase project and MinIO endpoint
   (not the SQLite dev setup). Don't set `PORT`; Railway injects it and
   `next start` reads it automatically.
3. **Custom domain** — Service → Settings → Networking → Custom Domain →
   enter `dataset.objectways.com`. Railway returns a CNAME target; add a
   CNAME record for the `dataset` subdomain at your DNS provider pointing to
   that target. Railway issues the TLS cert once the record resolves
   (usually a few minutes, occasionally longer for DNS propagation).
4. Pushes to the tracked branch redeploy automatically.

## What's stubbed, and how to un-stub it

This is a design-to-code scaffold, not wired to live infrastructure yet:

- **Auth** (`src/lib/auth.ts`) — real password hashing (`src/lib/password.ts`,
  scrypt) behind a plain cookie session, not a real IdP. Replace
  `getSession()`'s cookie read with a Clerk or Supabase Auth session lookup
  (per the architecture memo) and delete `src/app/sign-in/*` and
  `src/app/register/*`. Keep the `Session` type shape (`role`,
  `organizationId`) — the rest of the app reads from that, not from cookies
  directly.
- **Database** (`prisma/schema.prisma`) — SQLite locally for a zero-dependency
  setup. For production, change `datasource db { provider = "postgresql" }`
  and point `DATABASE_URL` at managed Postgres (Neon/Supabase). No SQLite-only
  features are used, so this is a one-line change plus a fresh migration.
- **Object storage** (`src/lib/storage.ts`) — real signed URLs once
  `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_ACCESS_KEY_ID`, and
  `OBJECT_STORAGE_SECRET_ACCESS_KEY` are set, pointed at a MinIO instance
  running against the NAS's storage (`forcePathStyle` is required for
  MinIO — see the client config). Without them, it falls back to
  `/placeholder-download` so every page stays clickable in dev.
- **Ingestion worker** — not part of this repo. `/uploads` reads whatever is
  already in the `Episode` table; the worker that validates, anonymizes, and
  writes those rows from NAS captures to MinIO is a separate service to
  build next.

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
