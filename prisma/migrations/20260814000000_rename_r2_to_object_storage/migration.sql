-- Rename R2-specific column names now that object storage is MinIO
-- (running as a QNAP NAS app), not Cloudflare R2.
ALTER TABLE "Dataset" RENAME COLUMN "r2Prefix" TO "objectPrefix";
ALTER TABLE "Episode" RENAME COLUMN "r2Key" TO "objectKey";
