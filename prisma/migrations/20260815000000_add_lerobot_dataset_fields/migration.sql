-- Datasets in the real MinIO bucket follow the LeRobot layout (per-episode
-- parquet + per-episode-per-camera video files under a chunk folder), not a
-- single preview.mp4/manifest.tar. These columns let the catalog derive
-- real object keys instead of assuming flat filenames.
ALTER TABLE "Dataset" ADD COLUMN "chunk" TEXT NOT NULL DEFAULT 'chunk-000';
ALTER TABLE "Dataset" ADD COLUMN "cameras" TEXT[] NOT NULL DEFAULT '{}';
