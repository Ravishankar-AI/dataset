-- Move object-storage layout (objectPrefix/chunk/cameras) down from Dataset
-- to Task, since a multi-task dataset groups tasks that each come from a
-- separate raw capture folder with its own bucket prefix and camera set.
-- Existing single-task datasets (e.g. Clutter Sort) get backfilled from
-- their Dataset row so nothing breaks.

ALTER TABLE "Task" ADD COLUMN "objectPrefix" TEXT;
ALTER TABLE "Task" ADD COLUMN "chunk" TEXT NOT NULL DEFAULT 'chunk-000';
ALTER TABLE "Task" ADD COLUMN "cameras" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "Task" t
SET "objectPrefix" = d."objectPrefix",
    "chunk" = d."chunk",
    "cameras" = d."cameras"
FROM "Dataset" d
WHERE t."datasetId" = d."id" AND t."objectPrefix" IS NULL;

ALTER TABLE "Task" ALTER COLUMN "objectPrefix" SET NOT NULL;

-- Allows idempotent per-episode upserts when seeding a task's episodes.
-- Multiple NULLs (pre-Task demo episodes) remain unaffected since Postgres
-- treats each NULL as distinct in a unique index.
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_taskId_episodeIndex_key" UNIQUE ("taskId", "episodeIndex");
