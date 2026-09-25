import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";
import { episodeThumbnailKey, episodeVideoKey } from "@/lib/lerobot";
import { getObjectBuffer, listObjectKeys } from "@/lib/minio";

// TEMPORARY: regenerates real thumbnails for the ~80 tasks whose
// hasThumbnail flag got turned off (see the earlier debug/thumbnails
// route, now removed) because no JPEG was ever uploaded for them. ffmpeg
// isn't available in this container, so frame extraction happens in the
// sandbox: GET streams the episode-0 video for a task back out (the
// sandbox can't reach nas.objectways.com directly, only this deployed
// app can), the sandbox runs ffmpeg locally, and POST takes the resulting
// JPEG bytes, uploads them to the expected thumbnail key, and flips
// hasThumbnail back on. Remove this whole route once the backfill is done.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

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

// GET ?secret&taskId -> streams back { videoKey, cameras } metadata, or
// with &download=1 streams the raw mp4 bytes of the primary camera.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const primaryCamera = [...task.cameras].sort()[0];
  if (!primaryCamera) return NextResponse.json({ error: "task has no cameras" }, { status: 400 });

  const videoKey = episodeVideoKey(task, 0, primaryCamera);

  if (req.nextUrl.searchParams.get("download") === "1") {
    let buf: Buffer | null;
    try {
      buf = await getObjectBuffer(videoKey);
    } catch (err) {
      return NextResponse.json({ error: "fetch failed", videoKey, detail: String(err) }, { status: 404 });
    }
    if (!buf) return NextResponse.json({ error: "video not found", videoKey }, { status: 404 });
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "video/mp4" } });
  }

  return NextResponse.json({ taskId, primaryCamera, videoKey, thumbKey: episodeThumbnailKey(task, 0) });
}

// POST ?secret&taskId with a raw JPEG body -> uploads to the expected
// thumbnail key and flips hasThumbnail=true for that task's episode 0.
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
    new PutObjectCommand({
      Bucket: process.env.MINIO_BUCKET || "teleoperation",
      Key: key,
      Body: bytes,
      ContentType: "image/jpeg",
    })
  );

  const updated = await prisma.episode.updateMany({
    where: { taskId: task.id, episodeIndex: 0 },
    data: { hasThumbnail: true },
  });

  return NextResponse.json({ taskId, key, bytes: bytes.byteLength, episodesUpdated: updated.count });
}

// GET-adjacent helper: list task ids currently missing a thumbnail
// (hasThumbnail false on episode 0) so the sandbox loop doesn't need its
// own Postgres access.
export async function PUT(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const take = Number(req.nextUrl.searchParams.get("limit") ?? 100);
  const skip = Number(req.nextUrl.searchParams.get("skip") ?? 0);

  const episodes = await prisma.episode.findMany({
    where: { episodeIndex: 0, hasThumbnail: false },
    take,
    skip,
    orderBy: { taskId: "asc" },
    include: { task: true },
  });

  const tasks = episodes
    .filter((e) => e.task)
    .map((e) => ({ taskId: e.task!.id, title: e.task!.title, cameras: e.task!.cameras }));

  return NextResponse.json({ count: tasks.length, tasks });
}
