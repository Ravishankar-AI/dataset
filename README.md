# Objectways Data

Next.js scaffold for the robotics dataset catalog: **one dataset registry, three
access-level doors** (Samples / Uploads / Datasets) over the NAS/MinIO pipeline.

## Architecture recap

- **NAS + MinIO** — a QNAP NAS running MinIO (S3-compatible) as an app, so
  MinIO's storage backend is the NAS's own disk — there's no separate
  copy-to-object-storage step. Everything — public sample clips, licensed
  customer datasets, and raw unreviewed capture staging alike — lives in one
  bucket (`teleoperation`). Real captures follow the
  [LeRobot](https://huggingface.co/docs/lerobot) layout:
  `<prefix>data/<chunk>/episode_NNNNNN.parquet` plus one
  `<prefix>videos/<chunk>/<camera>/episode_NNNNNN.mp4` per camera — not a
  single flat preview clip or archive file. Downloads are signed URLs
  straight from MinIO (`src/lib/minio.ts`) — the app server never proxies
  file bytes, and a licensed dataset's "download" is a manifest of
  per-file signed URLs (`/datasets/[slug]/manifest`), not a single archive.
  `/uploads` also shows a live, read-only top-level folder listing of the
  bucket, since most of what's actually in there is unreviewed raw capture
  staging (duplicates, typos, test uploads) rather than catalog-ready data —
  only one dataset (`Clutter Sort`) has been verified clean enough to seed.
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
cp .env.example .env   # fill in DATABASE_URL from your Railway Postgres service
npm run db:migrate     # applies the schema to that database
npm run db:seed        # seeds modalities, sample/customer datasets, episodes, demo users
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
   Variables tab, pointed at the real Railway Postgres service and MinIO
   endpoint. Don't set `PORT`; Railway injects it and `next start` reads it
   automatically.
3. **Custom domain** — Service → Settings → Networking → Custom Domain →
   enter `dataset.objectways.com`. Railway returns a CNAME target; add a
   CNAME record for the `dataset` subdomain at your DNS provider pointing to
   that target. Railway issues the TLS cert once the record resolves
   (usually a few minutes, occasionally longer for DNS propagation).
4. Pushes to the tracked branch redeploy automatically.

## What's stubbed, and how to un-stub it

This is a design-to-code scaffold, not fully wired to live infrastructure yet:

- **Auth** (`src/lib/auth.ts`) — real password hashing (`src/lib/password.ts`,
  scrypt) behind a plain cookie session, not a real IdP — no email
  verification or password reset flow. Replace `getSession()`'s cookie read
  with a Clerk session lookup, or a self-hosted option like Auth.js
  (NextAuth) using the Prisma adapter against this same Railway Postgres,
  and delete `src/app/sign-in/*` and `src/app/register/*`. Keep the
  `Session` type shape (`role`, `organizationId`) — the rest of the app
  reads from that, not from cookies directly.
- **Database** (`prisma/schema.prisma`) — already targets Postgres
  (`datasource db { provider = "postgresql" }`); point `DATABASE_URL` at
  your Railway Postgres service's connection string to use it.
- **MinIO** (`src/lib/minio.ts`) — real signed URLs and live bucket listings
  once `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, and `MINIO_SECRET_KEY` are set
  (`forcePathStyle` is required for MinIO — see the client config). Without
  them, downloads fall back to `/placeholder-download` and `/uploads`'
  bucket browser shows an empty result, so every page stays clickable in
  dev. The QNAP reverse proxy's TLS chain is currently incomplete (confirmed
  via `openssl s_client -showcerts` — it serves the leaf cert but not the
  Let's Encrypt intermediate); `MINIO_TLS_INSECURE=true` is a stopgap for
  that, not the real fix.
- **Ingestion worker** — not part of this repo. `/uploads` reads whatever is
  already in the `Episode` table and shows a live, unfiltered listing of
  what's sitting in the bucket; the worker that reviews, validates,
  anonymizes, and catalogs specific NAS captures into `Episode`/`Dataset`
  rows is a separate service to build next.

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
