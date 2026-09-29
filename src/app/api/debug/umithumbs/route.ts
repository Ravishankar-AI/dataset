import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";
import { episodeThumbnailKey, episodeVideoKey } from "@/lib/lerobot";
import { getObjectBuffer } from "@/lib/minio";

// TEMPORARY: backfills thumbnails for the UMI gripper tasks. Unlike the
// teleoperation rig, the alphabetically-first camera here is a depth
// stream ("observation.depth..." sorts before "observation.images...") --
// episodeThumbnailKey's convention of "alphabetically first camera" picks
// the wrong one for a representative preview image, so this explicitly
// picks the first observation.images.* (RGB) camera instead. Remove after
// use.
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

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    const tasks = await prisma.task.findMany({
      where: { dataset: { slug: "umi-gripper-capture" } },
      select: { id: true, title: true, cameras: true },
    });
    return NextResponse.json({ tasks });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const rgbCamera = [...task.cameras].filter((c) => c.startsWith("observation.images.")).sort()[0];
  if (!rgbCamera) return NextResponse.json({ error: "no RGB camera on this task" }, { status: 400 });

  const videoKey = episodeVideoKey(task, 0, rgbCamera);

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

  return NextResponse.json({ taskId, rgbCamera, videoKey, thumbKey: episodeThumbnailKey(task, 0) });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength < 100) {
    return NextResponse.json({ error: "body too small, refusing to upload" }, { status: 400 });
  }

  const key = episodeThumbnailKey(task, 0);
  await client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: "image/jpeg" })
  );

  const updated = await prisma.episode.updateMany({
    where: { taskId: task.id, episodeIndex: 0 },
    data: { hasThumbnail: true },
  });

  return NextResponse.json({ taskId, key, bytes: bytes.byteLength, episodesUpdated: updated.count });
}
