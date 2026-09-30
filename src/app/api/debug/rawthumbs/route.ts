import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";
import { episodeThumbnailKey } from "@/lib/lerobot";

// TEMPORARY: thumbnail backfill for raw (non-LeRobot) captures --
// egocentric-gripper-capture and orbbec-egocentric-capture -- using each
// episode's videoKeys override instead of the LeRobot convention. Supports
// a byte-range-limited fetch for orbbec's multi-GB files (see
// Episode.videoKeys' doc comment and the earlier feasibility test: a
// partial fetch is enough since the moov atom sits near the start).
// Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

const DATASET_BUCKETS: Record<string, string> = {
  "egocentric-gripper-capture": "egocentric-gripper",
  "orbbec-egocentric-capture": "orbbec",
};

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function client() {
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

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const datasetSlug = req.nextUrl.searchParams.get("dataset");
  if (!datasetSlug || !DATASET_BUCKETS[datasetSlug]) {
    return NextResponse.json({ error: "dataset must be one of " + Object.keys(DATASET_BUCKETS).join(", ") }, { status: 400 });
  }
  const bucket = DATASET_BUCKETS[datasetSlug];

  if (req.nextUrl.searchParams.get("listMissing") === "1") {
    const take = Number(req.nextUrl.searchParams.get("limit") ?? 60);
    const skip = Number(req.nextUrl.searchParams.get("skip") ?? 0);
    const episodes = await prisma.episode.findMany({
      where: { hasThumbnail: false, task: { dataset: { slug: datasetSlug } } },
      take,
      skip,
      orderBy: [{ taskId: "asc" }, { episodeIndex: "asc" }],
      select: { taskId: true, episodeIndex: true, videoKeys: true },
    });
    return NextResponse.json({
      count: episodes.length,
      items: episodes.map((e) => ({ taskId: e.taskId, episodeIndex: e.episodeIndex })),
    });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  const episodeIndex = Number(req.nextUrl.searchParams.get("episodeIndex") ?? 0);
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const episode = await prisma.episode.findFirst({ where: { taskId, episodeIndex } });
  if (!episode || !episode.videoKeys) return NextResponse.json({ error: "episode or videoKeys not found" }, { status: 404 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  // A dataset's tasks can span multiple physical buckets (e.g. UMI (Custom
  // Gripper) mixes egocentric-gripper and conveyor-warehouse-usecases), so
  // a per-task override always wins over the dataset-level default.
  const effectiveBucket = task?.bucket ?? bucket;

  const videoKeys = episode.videoKeys as Record<string, string>;
  const firstCamera = Object.keys(videoKeys)[0];
  const videoKey = videoKeys[firstCamera];

  if (req.nextUrl.searchParams.get("download") === "1") {
    const rangeBytes = req.nextUrl.searchParams.get("rangeBytes");
    try {
      const resp = await client().send(
        new GetObjectCommand({
          Bucket: effectiveBucket,
          Key: videoKey,
          ...(rangeBytes ? { Range: `bytes=0-${Number(rangeBytes) - 1}` } : {}),
        })
      );
      const bytes = await resp.Body!.transformToByteArray();
      return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": "video/mp4" } });
    } catch (err) {
      return NextResponse.json({ error: "fetch failed", videoKey, detail: String(err) }, { status: 404 });
    }
  }

  return NextResponse.json({
    taskId,
    episodeIndex,
    firstCamera,
    videoKey,
    bucket: effectiveBucket,
    thumbKey: task ? episodeThumbnailKey(task, episodeIndex) : null,
  });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const datasetSlug = req.nextUrl.searchParams.get("dataset");
  if (!datasetSlug || !DATASET_BUCKETS[datasetSlug]) {
    return NextResponse.json({ error: "dataset must be one of " + Object.keys(DATASET_BUCKETS).join(", ") }, { status: 400 });
  }
  const bucket = DATASET_BUCKETS[datasetSlug];

  const taskId = req.nextUrl.searchParams.get("taskId");
  const episodeIndex = Number(req.nextUrl.searchParams.get("episodeIndex") ?? 0);
  const durationSeconds = req.nextUrl.searchParams.get("durationSeconds");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength < 100) {
    return NextResponse.json({ error: "body too small, refusing to upload" }, { status: 400 });
  }

  const key = episodeThumbnailKey(task, episodeIndex);
  await client().send(new PutObjectCommand({ Bucket: task.bucket ?? bucket, Key: key, Body: bytes, ContentType: "image/jpeg" }));

  const updated = await prisma.episode.updateMany({
    where: { taskId: task.id, episodeIndex },
    data: {
      hasThumbnail: true,
      ...(durationSeconds ? { durationSeconds: Math.max(1, Math.round(Number(durationSeconds))) } : {}),
    },
  });

  return NextResponse.json({ taskId, episodeIndex, key, bytes: bytes.byteLength, episodesUpdated: updated.count });
}
