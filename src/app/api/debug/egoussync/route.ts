import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";

// TEMPORARY: populates the catalog for egocentric-data-pool/united_states --
// raw single-camera egocentric footage split by capture equipment (chest
// -mounted camera, GoPro, Meta smart glasses, phone), each equipment type
// becoming its own Modality/category per the user's request. Capped at 10
// episodes per task (same convention as every other dataset). Excludes
// rejected_files/less_than_30fbs/miscellaneous folders. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";
const BUCKET = "egocentric-data-pool";
const EPISODE_CAP = 10;

const EQUIPMENT: Record<string, { prefix: string; modalityKey: string; modalityName: string; datasetSlug: string; datasetTitle: string; robotType: string; cameraModel: string }> = {
  chestmount: {
    prefix: "united_states/chestmount/",
    modalityKey: "chestmount_camera",
    modalityName: "Chestmount Camera",
    datasetSlug: "chestmount-camera-us",
    datasetTitle: "Chestmount Camera Capture (US)",
    robotType: "Egocentric chest-mounted camera",
    cameraModel: "1x chest-mounted camera",
  },
  gopro: {
    prefix: "united_states/gopro/",
    modalityKey: "gopro_egocentric",
    modalityName: "GoPro (Egocentric)",
    datasetSlug: "gopro-egocentric-us",
    datasetTitle: "GoPro Egocentric Capture (US)",
    robotType: "Egocentric GoPro rig",
    cameraModel: "1x GoPro",
  },
  meta_glass: {
    prefix: "united_states/meta_glass/",
    modalityKey: "meta_glasses",
    modalityName: "Meta Glasses",
    datasetSlug: "meta-glasses-us",
    datasetTitle: "Meta Glasses Capture (US)",
    robotType: "Egocentric smart glasses",
    cameraModel: "1x Meta smart glasses camera",
  },
  mobile: {
    prefix: "united_states/mobile/",
    modalityKey: "mobile_egocentric",
    modalityName: "Mobile Phone (Egocentric)",
    datasetSlug: "mobile-egocentric-us",
    datasetTitle: "Mobile Phone Egocentric Capture (US)",
    robotType: "Egocentric handheld phone capture",
    cameraModel: "1x phone camera",
  },
};

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

async function listAllFiles(prefix: string): Promise<{ key: string; size: number }[]> {
  const files: { key: string; size: number }[] = [];
  let continuationToken: string | undefined;
  do {
    const resp = await rawClient().send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: continuationToken })
    );
    for (const o of resp.Contents ?? []) {
      if (!o.Key || o.Key.endsWith("/")) continue;
      if (/\/(rejected_files|less_than_30fbs|miscellaneous)\//.test(o.Key)) continue;
      if (!/\.(mp4|mov)$/i.test(o.Key)) continue;
      files.push({ key: o.Key, size: o.Size ?? 0 });
    }
    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);
  return files;
}

// "cleaning_stove_kitchen_us_98_0049.mp4" -> "cleaning_stove_kitchen"
function stripTaskName(filename: string): string {
  let name = filename.replace(/\.(mp4|mov)$/i, "");
  for (;;) {
    const next = name.replace(/(_usa)$/i, "").replace(/_\d+$/, "").replace(/(_us)$/i, "");
    if (next === name) break;
    name = next;
  }
  return name;
}

// Extracts a DD_MM_YYYY date folder segment from the key for chronological
// sort, so the first EPISODE_CAP taken are the earliest recordings rather
// than an arbitrary S3 listing order.
function dateSortKey(key: string): string {
  const m = key.match(/(\d{2})_(\d{2})_(\d{4})/);
  return m ? `${m[3]}${m[2]}${m[1]}` : "99999999";
}

// GET ?discover=1 -> task breakdown per equipment type, unprocessed.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const equipment = req.nextUrl.searchParams.get("equipment");
  if (!equipment || !EQUIPMENT[equipment]) {
    return NextResponse.json({ error: "equipment must be one of " + Object.keys(EQUIPMENT).join(", ") }, { status: 400 });
  }
  const cfg = EQUIPMENT[equipment];
  const files = await listAllFiles(cfg.prefix);
  const tasks = new Map<string, { key: string; size: number }[]>();
  for (const f of files) {
    const fname = f.key.split("/").pop()!;
    const task = stripTaskName(fname);
    const arr = tasks.get(task) ?? [];
    arr.push(f);
    tasks.set(task, arr);
  }
  return NextResponse.json({
    equipment,
    totalFiles: files.length,
    taskCount: tasks.size,
    tasks: Array.from(tasks.entries()).map(([task, fs]) => ({ task, count: fs.length })),
  });
}

// POST ?equipment=mobile -- syncs one equipment type's full task list into
// its own Modality + Dataset, up to EPISODE_CAP episodes per task.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const equipment = req.nextUrl.searchParams.get("equipment");
  if (!equipment || !EQUIPMENT[equipment]) {
    return NextResponse.json({ error: "equipment must be one of " + Object.keys(EQUIPMENT).join(", ") }, { status: 400 });
  }
  const cfg = EQUIPMENT[equipment];

  const modality = await prisma.modality.upsert({
    where: { key: cfg.modalityKey },
    update: {},
    create: {
      key: cfg.modalityKey,
      name: cfg.modalityName,
      sensorManifest: "1x egocentric POV camera",
      sensorNote: "Raw single-camera egocentric footage, unprocessed -- no pose/state data.",
      typicalUse: "First-person household task capture for imitation learning.",
    },
  });

  const dataset = await prisma.dataset.upsert({
    where: { slug: cfg.datasetSlug },
    update: {},
    create: {
      slug: cfg.datasetSlug,
      title: cfg.datasetTitle,
      description: `Raw egocentric footage captured via ${humanize(equipment)} across household tasks in the US. Unprocessed -- camera footage only, capped at ${EPISODE_CAP} episodes per task.`,
      modalityId: modality.id,
      accessTier: "sample",
      status: "published",
      version: "v1",
      sizeBytes: 0,
      objectPrefix: cfg.prefix,
      fps: 30,
      robotType: cfg.robotType,
      cameraModel: cfg.cameraModel,
      bucket: BUCKET,
    },
  });

  const files = await listAllFiles(cfg.prefix);
  const tasks = new Map<string, { key: string; size: number }[]>();
  for (const f of files) {
    const fname = f.key.split("/").pop()!;
    const task = stripTaskName(fname);
    const arr = tasks.get(task) ?? [];
    arr.push(f);
    tasks.set(task, arr);
  }

  const results: { title: string; episodesCreated: number }[] = [];
  let taskIndex = await prisma.task.count({ where: { datasetId: dataset.id } });

  for (const [taskName, taskFiles] of tasks.entries()) {
    const sorted = [...taskFiles].sort((a, b) => dateSortKey(a.key).localeCompare(dateSortKey(b.key)));
    const capped = sorted.slice(0, EPISODE_CAP);
    const title = humanize(taskName);
    const objectPrefix = cfg.prefix + taskName + "/";

    const existing = await prisma.task.findFirst({ where: { datasetId: dataset.id, title } });
    const thisTaskIndex = existing?.taskIndex ?? taskIndex++;

    const task = await prisma.task.upsert({
      where: { datasetId_taskIndex: { datasetId: dataset.id, taskIndex: thisTaskIndex } },
      update: { title, objectPrefix, cameras: ["camera"], cameraCount: 1, bucket: BUCKET },
      create: {
        datasetId: dataset.id,
        taskIndex: thisTaskIndex,
        title,
        objectPrefix,
        chunk: "chunk-000",
        cameras: ["camera"],
        cameraCount: 1,
        bucket: BUCKET,
      },
    });

    let created = 0;
    for (let i = 0; i < capped.length; i++) {
      const f = capped[i];
      const videoKeys = { camera: f.key };
      await prisma.episode.upsert({
        where: { taskId_episodeIndex: { taskId: task.id, episodeIndex: i } },
        update: { videoKeys, sizeBytes: f.size },
        create: {
          datasetId: dataset.id,
          taskId: task.id,
          episodeIndex: i,
          capturedAt: new Date(),
          durationSeconds: 1, // unknown until ffprobe'd during thumbnail backfill
          sizeBytes: f.size,
          objectKey: f.key,
          status: "cataloged",
          videoKeys,
        },
      });
      created++;
    }
    results.push({ title, episodesCreated: created });
  }

  return NextResponse.json({ equipment, datasetId: dataset.id, taskCount: results.length, results });
}
