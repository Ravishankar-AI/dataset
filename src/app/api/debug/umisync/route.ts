import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";
import { listBucketEntries, getObjectBuffer } from "@/lib/minio";
import { parseDatasetInfo } from "@/lib/telemetry";

// TEMPORARY: populates the catalog for the UMI gripper capture
// (pika-sense-umi-data bucket, Input/lerobot/{environment}/{task}/ per
// task folder) under the existing "UMI Gripper" Modality. Idempotent --
// upserts by slug/taskIndex/episodeIndex, safe to re-run. Remove once
// the catalog looks right on the live site.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";
const BUCKET = "pika-sense-umi-data";
const ROOT_PREFIX = "Input/lerobot/";
const DATASET_SLUG = "umi-gripper-capture";

function humanize(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function rawClient() {
  return new S3Client({
    region: "us-east-1",
    endpoint: process.env.MINIO_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    ...(process.env.MINIO_TLS_INSECURE === "true"
      ? { requestHandler: new NodeHttpHandler({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) }) }
      : {}),
  });
}

async function totalSizeUnder(prefix: string): Promise<number> {
  let total = 0;
  let token: string | undefined;
  do {
    const resp = await rawClient().send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token })
    );
    for (const obj of resp.Contents ?? []) total += obj.Size ?? 0;
    token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (token);
  return total;
}

type DiscoveredTask = {
  environment: string;
  task: string;
  objectPrefix: string;
};

async function discoverTasks(): Promise<DiscoveredTask[]> {
  const envListing = await listBucketEntries(ROOT_PREFIX, BUCKET);
  const tasks: DiscoveredTask[] = [];
  for (const envEntry of envListing.entries) {
    const taskListing = await listBucketEntries(envEntry.prefix, BUCKET);
    for (const taskEntry of taskListing.entries) {
      tasks.push({ environment: envEntry.name, task: taskEntry.name, objectPrefix: taskEntry.prefix });
    }
  }
  return tasks;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get("verify") === "1") {
    const dataset = await prisma.dataset.findUnique({
      where: { slug: DATASET_SLUG },
      include: {
        modality: true,
        tasks: { include: { _count: { select: { episodes: true } }, episodes: { where: { episodeIndex: 0 }, take: 1 } } },
      },
    });
    return NextResponse.json({
      dataset: dataset
        ? {
            slug: dataset.slug,
            title: dataset.title,
            modality: dataset.modality.name,
            accessTier: dataset.accessTier,
            status: dataset.status,
            bucket: dataset.bucket,
            tasks: dataset.tasks.map((t) => ({
              title: t.title,
              objectPrefix: t.objectPrefix,
              cameras: t.cameras,
              cameraCount: t.cameraCount,
              episodeCount: t._count.episodes,
              firstEpisodeDuration: t.episodes[0]?.durationSeconds ?? null,
            })),
          }
        : null,
    });
  }

  const tasks = await discoverTasks();
  return NextResponse.json({ discovered: tasks.length, tasks });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const computeSize = req.nextUrl.searchParams.get("computeSize") === "1";

  const modality = await prisma.modality.upsert({
    where: { key: "umi_gripper" },
    update: {},
    create: {
      key: "umi_gripper",
      name: "UMI Gripper",
      sensorManifest: "4x RGB (2 fisheye, 2 wrist) + 2x depth",
      sensorNote: "+ wrist IMU, end-effector pose, per-episode data-quality QA",
      typicalUse: "In-the-wild grasp and manipulation capture without a fixed rig.",
    },
  });

  const sizeBytes = computeSize ? await totalSizeUnder(ROOT_PREFIX) : 0;

  const dataset = await prisma.dataset.upsert({
    where: { slug: DATASET_SLUG },
    update: computeSize ? { sizeBytes } : {},
    create: {
      slug: DATASET_SLUG,
      title: "UMI Gripper Capture",
      description:
        "Pika Sense dual-arm UMI (Universal Manipulation Interface) handheld gripper captures across kitchen, bedroom, and industrial environments. End-effector pose + gripper per hand, wrist IMU, 4 RGB + 2 depth cameras, and a per-episode data-quality report from the capture pipeline.",
      modalityId: modality.id,
      accessTier: "sample",
      status: "published",
      version: "v1",
      sizeBytes,
      objectPrefix: "",
      fps: 30,
      robotType: "Pika Sense (dual-arm UMI gripper)",
      cameraModel: "4x RGB (2 fisheye + 2 wrist) + 2x depth",
      bucket: BUCKET,
    },
  });

  const discovered = await discoverTasks();
  const results: { task: string; environment: string; episodes: number; error?: string }[] = [];

  let taskIndex = 0;
  for (const d of discovered) {
    try {
      const infoBuffer = await getObjectBuffer(`${d.objectPrefix}meta/info.json`, BUCKET);
      if (!infoBuffer) {
        results.push({ task: d.task, environment: d.environment, episodes: 0, error: "no info.json" });
        continue;
      }
      const info = parseDatasetInfo(infoBuffer);
      if (!info) {
        results.push({ task: d.task, environment: d.environment, episodes: 0, error: "unparseable info.json" });
        continue;
      }

      const cameras = Object.entries(info.features)
        .filter(([key, schema]) => (key.startsWith("observation.images.") || key.startsWith("observation.depth.")) && schema.dtype === "video")
        .map(([key]) => key)
        .sort();

      let objects: string[] = [];
      let taskLabel = d.task;
      const tasksJsonlBuffer = await getObjectBuffer(`${d.objectPrefix}meta/tasks.jsonl`, BUCKET).catch(() => null);
      if (tasksJsonlBuffer) {
        const firstLine = tasksJsonlBuffer.toString("utf-8").split("\n").find((l) => l.trim());
        if (firstLine) {
          try {
            const parsed = JSON.parse(firstLine);
            if (Array.isArray(parsed.objects)) objects = parsed.objects;
          } catch {
            /* ignore, fall back to folder name only */
          }
        }
      }

      const title = `[${humanize(d.environment)}] ${humanize(taskLabel)}${objects.length ? `, Objects: ${objects.join(", ")}` : ""}`;

      const task = await prisma.task.upsert({
        where: { datasetId_taskIndex: { datasetId: dataset.id, taskIndex } },
        update: { title, objectPrefix: d.objectPrefix, cameras, cameraCount: cameras.length, bucket: BUCKET },
        create: {
          datasetId: dataset.id,
          taskIndex,
          title,
          objectPrefix: d.objectPrefix,
          chunk: "chunk-000",
          cameras,
          cameraCount: cameras.length,
          bucket: BUCKET,
        },
      });
      taskIndex++;

      const episodesJsonlBuffer = await getObjectBuffer(`${d.objectPrefix}meta/episodes.jsonl`, BUCKET);
      if (!episodesJsonlBuffer) {
        results.push({ task: d.task, environment: d.environment, episodes: 0, error: "no episodes.jsonl" });
        continue;
      }

      const lines = episodesJsonlBuffer.toString("utf-8").split("\n").filter((l) => l.trim());
      let episodeCount = 0;
      for (const line of lines) {
        const rec = JSON.parse(line);
        const episodeIndex: number = rec.episode_index;
        const length: number = rec.length ?? 0;
        const durationSeconds = Math.max(1, Math.round(length / info.fps));

        await prisma.episode.upsert({
          where: { taskId_episodeIndex: { taskId: task.id, episodeIndex } },
          update: { durationSeconds },
          create: {
            datasetId: dataset.id,
            taskId: task.id,
            episodeIndex,
            capturedAt: new Date(),
            durationSeconds,
            sizeBytes: 0,
            objectKey: `${d.objectPrefix}data/chunk-000/episode_${String(episodeIndex).padStart(6, "0")}.parquet`,
            status: "cataloged",
          },
        });
        episodeCount++;
      }

      results.push({ task: d.task, environment: d.environment, episodes: episodeCount });
    } catch (err) {
      results.push({ task: d.task, environment: d.environment, episodes: 0, error: String(err) });
    }
  }

  return NextResponse.json({
    modalityId: modality.id,
    datasetId: dataset.id,
    datasetSlug: dataset.slug,
    tasksProcessed: results.length,
    results,
  });
}
