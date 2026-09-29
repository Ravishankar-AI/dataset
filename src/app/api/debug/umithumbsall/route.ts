import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";
import { episodeThumbnailKey, episodeVideoKey } from "@/lib/lerobot";
import { getObjectBuffer } from "@/lib/minio";

// TEMPORARY: the earlier UMI thumbnail backfill only covered episode 0 per
// task (enough to fix the task-list card), but the per-task deliverables
// page shows one thumbnail per episode and expects hasThumbnail set on
// each -- every other episode still shows the placeholder icon. This
// covers every episode, not just index 0. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";
const BUCKET = "pika-sense-umi-data";

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

// GET ?listMissing=1 -> every (taskId, episodeIndex) still missing a
// thumbnail, across the whole UMI dataset.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  if (req.nextUrl.searchParams.get("listMissing") === "1") {
    const take = Number(req.nextUrl.searchParams.get("limit") ?? 60);
    const skip = Number(req.nextUrl.searchParams.get("skip") ?? 0);
    const episodes = await prisma.episode.findMany({
      where: { hasThumbnail: false, task: { dataset: { slug: "umi-gripper-capture" } } },
      take,
      skip,
      orderBy: [{ taskId: "asc" }, { episodeIndex: "asc" }],
      include: { task: { select: { id: true, cameras: true } } },
    });
    return NextResponse.json({
      count: episodes.length,
      items: episodes
        .filter((e) => e.task && e.episodeIndex != null)
        .map((e) => ({ taskId: e.task!.id, episodeIndex: e.episodeIndex })),
    });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  const episodeIndex = Number(req.nextUrl.searchParams.get("episodeIndex") ?? 0);
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const rgbCamera = [...task.cameras].filter((c) => c.startsWith("observation.images.")).sort()[0];
  if (!rgbCamera) return NextResponse.json({ error: "no RGB camera on this task" }, { status: 400 });

  const videoKey = episodeVideoKey(task, episodeIndex, rgbCamera);

  if (req.nextUrl.searchParams.get("download") === "1") {
    let buf: Buffer | null;
    try {
      buf = await getObjectBuffer(videoKey, BUCKET);
    } catch (err) {
      return NextResponse.json({ error: "fetch failed", videoKey, detail: String(err) }, { status: 404 });
    }
    if (!buf) return NextResponse.json({ error: "video not found", videoKey }, { status: 404 });
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "video/mp4" } });
  }

  return NextResponse.json({ taskId, episodeIndex, rgbCamera, videoKey, thumbKey: episodeThumbnailKey(task, episodeIndex) });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const taskId = req.nextUrl.searchParams.get("taskId");
  const episodeIndex = Number(req.nextUrl.searchParams.get("episodeIndex") ?? 0);
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength < 100) {
    return NextResponse.json({ error: "body too small, refusing to upload" }, { status: 400 });
  }

  const key = episodeThumbnailKey(task, episodeIndex);
  await client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: "image/jpeg" })
  );

  const updated = await prisma.episode.updateMany({
    where: { taskId: task.id, episodeIndex },
    data: { hasThumbnail: true },
  });

  return NextResponse.json({ taskId, episodeIndex, key, bytes: bytes.byteLength, episodesUpdated: updated.count });
}
