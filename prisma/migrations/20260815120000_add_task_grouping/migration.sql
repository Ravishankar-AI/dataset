-- Task grouping (from LeRobot's meta/tasks.jsonl), real per-episode
-- duration/index, and dataset-level fps/robotType (from meta/info.json).

ALTER TABLE "Dataset" ADD COLUMN "fps" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Dataset" ADD COLUMN "robotType" TEXT;

CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "taskIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Task_datasetId_taskIndex_key" ON "Task"("datasetId", "taskIndex");

ALTER TABLE "Task" ADD CONSTRAINT "Task_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Episode" ADD COLUMN "taskId" TEXT;
ALTER TABLE "Episode" ADD COLUMN "episodeIndex" INTEGER;

ALTER TABLE "Episode" ADD CONSTRAINT "Episode_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
