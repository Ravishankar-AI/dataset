import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";

// TEMPORARY: populates the catalog for the orbbec bucket -- raw
// egocentric-headset recordings (Orbbec stereo IR cameras + IMU + audio),
// one continuous session per task attempt, no LeRobot processing (see
// Episode.videoKeys' doc comment). Much smaller scale than the gripper
// buckets (~66 sessions total), so this does the whole sync in one POST
// rather than per-variant like egosync. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";
const BUCKET = "orbbec";
const DATASET_SLUG = "orbbec-egocentric-capture";

const ROOTS: { prefix: string; envLabel: string }[] = [
  { prefix: "house_hold_data/kitchen/", envLabel: "Kitchen" },
  { prefix: "house_hold_data/bedroom/", envLabel: "Bedroom" },
  { prefix: "wide_angle/kitchen/", envLabel: "Kitchen (wide-angle)" },
  { prefix: "industrial_data/garments/india/", envLabel: "Garments (India)" },
];

function humanize(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// "cutting_beans_kitchen_002" -> "cutting_beans_kitchen"
function stripTrailingCounter(name: string) {
  return name.replace(/_\d+$/, "");
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

async function listDirs(prefix: string): Promise<string[]> {
  const resp = await rawClient().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, Delimiter: "/" }));
  return (resp.CommonPrefixes ?? []).map((p) => p.Prefix ?? "").filter(Boolean);
}

async function listFiles(prefix: string): Promise<{ key: string; size: number }[]> {
  const resp = await rawClient().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, Delimiter: "/" }));
  return (resp.Contents ?? [])
    .filter((o) => o.Key && !o.Key.endsWith("/"))
    .map((o) => ({ key: o.Key!, size: o.Size ?? 0 }));
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessions: { envLabel: string; date: string; sessionPrefix: string; sessionName: string }[] = [];
  for (const root of ROOTS) {
    const dateDirs = await listDirs(root.prefix);
    for (const dateDir of dateDirs) {
      const date = dateDir.slice(root.prefix.length).replace(/\/$/, "");
      const sessionDirs = await listDirs(dateDir);
      for (const sessionPrefix of sessionDirs) {
        const sessionName = sessionPrefix.slice(dateDir.length).replace(/\/$/, "");
        sessions.push({ envLabel: root.envLabel, date, sessionPrefix, sessionName });
      }
    }
  }
  return NextResponse.json({ count: sessions.length, sessions });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const modality = await prisma.modality.upsert({
    where: { key: "egocentric" },
    update: {},
    create: {
      key: "egocentric",
      name: "Egocentric",
      sensorManifest: "Stereo IR cameras (1600x1300, KB fisheye)",
      sensorNote: "+ 6-axis IMU + audio, per-frame timestamp CSVs, factory calibration",
      typicalUse: "First-person task and object-interaction data for imitation learning.",
    },
  });

  const dataset = await prisma.dataset.upsert({
    where: { slug: DATASET_SLUG },
    update: {},
    create: {
      slug: DATASET_SLUG,
      title: "Orbbec Egocentric Capture",
      description:
        "Raw egocentric headset recordings (Orbbec stereo IR cameras, 6-axis IMU, audio) across household and light-industrial tasks. One continuous take per session -- unprocessed, no pose/state data.",
      modalityId: modality.id,
      accessTier: "sample",
      status: "published",
      version: "v1",
      sizeBytes: 0,
      objectPrefix: "",
      fps: 30,
      robotType: "Egocentric headset (Orbbec)",
      cameraModel: "Stereo IR 1600x1300 (KB fisheye) + IMU + audio",
      bucket: BUCKET,
    },
  });

  // Discover, then group sessions into tasks by (environment, base name)
  // across every date -- the same task recorded on different days merges
  // into one Task with multiple episodes, rather than one Task per date.
  const grouped = new Map<string, { envLabel: string; baseName: string; sessions: { date: string; sessionPrefix: string; sessionName: string }[] }>();
  for (const root of ROOTS) {
    const dateDirs = await listDirs(root.prefix);
    for (const dateDir of dateDirs) {
      const date = dateDir.slice(root.prefix.length).replace(/\/$/, "");
      const sessionDirs = await listDirs(dateDir);
      for (const sessionPrefix of sessionDirs) {
        const sessionName = sessionPrefix.slice(dateDir.length).replace(/\/$/, "");
        const baseName = stripTrailingCounter(sessionName);
        const groupKey = `${root.envLabel}::${baseName}`;
        const g = grouped.get(groupKey) ?? { envLabel: root.envLabel, baseName, sessions: [] };
        g.sessions.push({ date, sessionPrefix, sessionName });
        grouped.set(groupKey, g);
      }
    }
  }

  const results: { title: string; episodesCreated: number; episodesSkipped: string[] }[] = [];
  let taskIndex = await prisma.task.count({ where: { datasetId: dataset.id } });

  for (const group of grouped.values()) {
    const title = `[${group.envLabel}] ${humanize(group.baseName)}`;
    const objectPrefix = group.sessions[0].sessionPrefix;

    const existing = await prisma.task.findFirst({ where: { datasetId: dataset.id, title } });
    const thisTaskIndex = existing?.taskIndex ?? taskIndex++;

    const task = await prisma.task.upsert({
      where: { datasetId_taskIndex: { datasetId: dataset.id, taskIndex: thisTaskIndex } },
      update: { title, objectPrefix, cameras: ["camera_left", "camera_right"], cameraCount: 2, bucket: BUCKET },
      create: {
        datasetId: dataset.id,
        taskIndex: thisTaskIndex,
        title,
        objectPrefix,
        chunk: "chunk-000",
        cameras: ["camera_left", "camera_right"],
        cameraCount: 2,
        bucket: BUCKET,
      },
    });

    let created = 0;
    const skipped: string[] = [];
    for (let i = 0; i < group.sessions.length; i++) {
      const { sessionPrefix, sessionName } = group.sessions[i];
      const deviceDirs = await listDirs(sessionPrefix);
      if (deviceDirs.length === 0) {
        skipped.push(sessionName);
        continue;
      }
      const files = await listFiles(deviceDirs[0]);
      const left = files.find((f) => /_camera_left_part0*1\.mp4$/i.test(f.key));
      const right = files.find((f) => /_camera_right_part0*1\.mp4$/i.test(f.key));
      if (!left && !right) {
        skipped.push(sessionName);
        continue;
      }

      const videoKeys: Record<string, string> = {};
      let totalSize = 0;
      if (left) { videoKeys.camera_left = left.key; totalSize += left.size; }
      if (right) { videoKeys.camera_right = right.key; totalSize += right.size; }

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

    results.push({ title, episodesCreated: created, episodesSkipped: skipped });
  }

  return NextResponse.json({ datasetId: dataset.id, taskGroups: results.length, results });
}
