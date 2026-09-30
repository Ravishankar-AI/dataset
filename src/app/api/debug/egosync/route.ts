import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";

// TEMPORARY: populates the catalog for raw (non-LeRobot) gripper/handheld
// footage -- originally egocentric-gripper/gripper_batch3, now also
// conveyor-warehouse-usecases/Industry (same Left/Right-per-episode shape,
// different bucket) -- both into the same "UMI (Custom Gripper)" dataset
// (Task.bucket overrides per task, same as the dataset's default bucket
// support). Capped at 10 episodes per task variant, matching every other
// task in the catalog. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";
const DEFAULT_BUCKET = "egocentric-gripper";
const DATASET_SLUG = "egocentric-gripper-capture";
const EPISODE_CAP = 10;

const ROOTS: { prefix: string; cameras: string[]; label: string }[] = [
  { prefix: "gripper_batch3/doublehand/", cameras: ["Left", "Right"], label: "Doublehand" },
  { prefix: "gripper_batch3/singlehand/", cameras: ["Gripper"], label: "Singlehand" },
  { prefix: "gripper_batch3/Industry Videos/doublehand/", cameras: ["Left", "Right"], label: "Industry" },
];

// Second source: conveyor-warehouse-usecases/Industry -- lives in its own
// bucket, so BUCKET_BY_LABEL below routes each root label to the right one.
const CONVEYOR_ROOTS: { prefix: string; cameras: string[]; label: string }[] = [
  { prefix: "Industry/Towel/Gopro/Packing/", cameras: ["Left", "Right"], label: "Conveyor-Towel-Gopro-Packing" },
  { prefix: "Industry/Towel/Gopro/Segregation/", cameras: ["Left", "Right"], label: "Conveyor-Towel-Gopro-Segregation" },
  { prefix: "Industry/Towel/Insta/Packing/", cameras: ["Left", "Right"], label: "Conveyor-Towel-Insta-Packing" },
  { prefix: "Industry/Towel/Insta/Segregation/", cameras: ["Left", "Right"], label: "Conveyor-Towel-Insta-Segregation" },
];
const CONVEYOR_BUCKET = "conveyor-warehouse-usecases";

function bucketForLabel(label: string): string {
  return label.startsWith("Conveyor-") ? CONVEYOR_BUCKET : DEFAULT_BUCKET;
}

function humanize(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
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

async function listDirs(prefix: string, bucket: string): Promise<string[]> {
  const resp = await rawClient().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/" }));
  return (resp.CommonPrefixes ?? []).map((p) => p.Prefix ?? "").filter(Boolean);
}

async function listFiles(prefix: string, bucket: string): Promise<{ key: string; size: number }[]> {
  const resp = await rawClient().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/" }));
  return (resp.Contents ?? [])
    .filter((o) => o.Key && !o.Key.endsWith("/"))
    .map((o) => ({ key: o.Key!, size: o.Size ?? 0 }));
}

function episodeNumber(prefix: string): number {
  const m = prefix.match(/Episode_(\d+)\/$/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

// GET ?discover=1 -> every (root, task, variant) tuple, unprocessed.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const variants: { rootLabel: string; cameras: string[]; task: string; variantPrefix: string }[] = [];
  for (const root of ROOTS) {
    const bucket = bucketForLabel(root.label);
    const taskDirs = await listDirs(root.prefix, bucket);
    for (const taskPrefix of taskDirs) {
      const taskName = taskPrefix.slice(root.prefix.length).replace(/\/$/, "");
      const variantDirs = await listDirs(taskPrefix, bucket);
      for (const variantPrefix of variantDirs) {
        variants.push({ rootLabel: root.label, cameras: root.cameras, task: taskName, variantPrefix });
      }
    }
  }
  // Conveyor roots are one level shallower: the root prefix itself directly
  // contains the numbered variant folders, with no intermediate task-name
  // level (e.g. "Industry/Towel/Gopro/Packing/2/" has Episode_N/ directly
  // inside it, unlike gripper_batch3's root/task/variant shape above).
  for (const root of CONVEYOR_ROOTS) {
    const bucket = bucketForLabel(root.label);
    const variantDirs = await listDirs(root.prefix, bucket);
    for (const variantPrefix of variantDirs) {
      variants.push({ rootLabel: root.label, cameras: root.cameras, task: root.label, variantPrefix });
    }
  }
  return NextResponse.json({ count: variants.length, variants });
}

// POST ?variantPrefix=...&cameras=Left,Right&rootLabel=Doublehand -- syncs
// one variant folder: up to EPISODE_CAP episodes (lowest Episode_N first),
// each with a videoKeys override per camera and real file sizes.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const variantPrefix = req.nextUrl.searchParams.get("variantPrefix");
  const camerasParam = req.nextUrl.searchParams.get("cameras");
  const rootLabel = req.nextUrl.searchParams.get("rootLabel") ?? "";
  if (!variantPrefix || !camerasParam) {
    return NextResponse.json({ error: "variantPrefix and cameras required" }, { status: 400 });
  }
  const cameras = camerasParam.split(",");
  const bucket = bucketForLabel(rootLabel);

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

  const dataset = await prisma.dataset.upsert({
    where: { slug: DATASET_SLUG },
    update: {},
    create: {
      slug: DATASET_SLUG,
      title: "Egocentric Gripper Capture (Raw)",
      description:
        "Raw handheld egocentric-gripper footage (single- and dual-hand rigs, GoPro cameras) across a wide range of household and light-industrial tasks. Unprocessed -- no pose/state data, this is camera footage only, capped at 10 episodes per task variant.",
      modalityId: modality.id,
      accessTier: "sample",
      status: "published",
      version: "v1",
      sizeBytes: 0,
      objectPrefix: "",
      fps: 30,
      robotType: cameras.length > 1 ? "Handheld dual-gripper rig" : "Handheld single-gripper rig",
      cameraModel: cameras.length > 1 ? "2x GoPro (left + right hand)" : "1x GoPro",
      bucket: DEFAULT_BUCKET,
    },
  });

  const variantName = variantPrefix.split("/").filter(Boolean).pop() ?? variantPrefix;
  const title = `[${rootLabel}] ${humanize(variantName)}`;

  // Reuse an existing task by objectPrefix (idempotent across re-runs)
  // rather than assuming a stable taskIndex ordering across many
  // separately-synced variants.
  const existing = await prisma.task.findFirst({ where: { datasetId: dataset.id, objectPrefix: variantPrefix } });
  const taskIndex = existing?.taskIndex ?? (await prisma.task.count({ where: { datasetId: dataset.id } }));

  const task = await prisma.task.upsert({
    where: { datasetId_taskIndex: { datasetId: dataset.id, taskIndex } },
    update: { title, objectPrefix: variantPrefix, cameras, cameraCount: cameras.length, bucket },
    create: {
      datasetId: dataset.id,
      taskIndex,
      title,
      objectPrefix: variantPrefix,
      chunk: "chunk-000",
      cameras,
      cameraCount: cameras.length,
      bucket,
    },
  });

  const episodeDirs = (await listDirs(variantPrefix, bucket)).sort((a, b) => episodeNumber(a) - episodeNumber(b)).slice(0, EPISODE_CAP);

  let created = 0;
  const skipped: string[] = [];
  for (let i = 0; i < episodeDirs.length; i++) {
    const episodeDir = episodeDirs[i];
    const videoKeys: Record<string, string> = {};
    let totalSize = 0;
    for (const camera of cameras) {
      const files = await listFiles(`${episodeDir}${camera}/`, bucket);
      const mp4 = files.find((f) => f.key.toLowerCase().endsWith(".mp4"));
      if (mp4) {
        videoKeys[camera] = mp4.key;
        totalSize += mp4.size;
      }
    }
    if (Object.keys(videoKeys).length === 0) {
      skipped.push(episodeDir);
      continue;
    }

    await prisma.episode.upsert({
      where: { taskId_episodeIndex: { taskId: task.id, episodeIndex: i } },
      update: { videoKeys, sizeBytes: totalSize },
      create: {
        datasetId: dataset.id,
        taskId: task.id,
        episodeIndex: i,
        capturedAt: new Date(),
        durationSeconds: 1, // unknown until ffprobe'd during thumbnail backfill
        sizeBytes: totalSize,
        objectKey: Object.values(videoKeys)[0],
        status: "cataloged",
        videoKeys,
      },
    });
    created++;
  }

  return NextResponse.json({ taskId: task.id, title, episodesCreated: created, episodesSkipped: skipped });
}
