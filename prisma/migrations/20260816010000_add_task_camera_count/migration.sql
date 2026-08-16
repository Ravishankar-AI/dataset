-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "cameraCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows from the real cameras array instead of leaving
-- them at the 0 default.
UPDATE "Task" SET "cameraCount" = COALESCE(array_length(cameras, 1), 0);
