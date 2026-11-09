import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";
import { episodeThumbnailKey, episodeVideoKey } from "@/lib/lerobot";

// TEMPORARY: thumbnail backfill for standard LeRobot-format datasets
// (teleoperation-capture, clutter-sort) using the normal episodeVideoKey
// convention instead of a videoKeys override -- these are real LeRobot
// captures, not raw single-file footage. Picks the alphabetically-first
// RGB camera (observation.images.*, skipping depth) as the thumbnail
// source, matching the convention used elsewhere in the catalog. Remove
// after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";
const DEFAULT_BUCKET = process.env.MINIO_BUCKET || "teleoperation";

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

function primaryCamera(cameras: string[]): string {
  const rgb = cameras.filter((c) => c.startsWith("observation.images.") && !c.toLowerCase().includes("depth"));
  const pool = rgb.length > 0 ? rgb : cameras;
  return [...pool].sort()[0];
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const datasetSlug = req.nextUrl.searchParams.get("dataset");
  if (!datasetSlug) return NextResponse.json({ error: "dataset required" }, { status: 400 });

  if (req.nextUrl.searchParams.get("listMissing") === "1") {
    const take = Number(req.nextUrl.searchParams.get("limit") ?? 60);
    const skip = Number(req.nextUrl.searchParams.get("skip") ?? 0);
    const episodes = await prisma.episode.findMany({
      where: { hasThumbnail: false, task: { dataset: { slug: datasetSlug } } },
      take,
      skip,
      orderBy: [{ taskId: "asc" }, { episodeIndex: "asc" }],
      select: { taskId: true, episodeIndex: true },
    });
    return NextResponse.json({
      count: episodes.length,
      items: episodes.map((e) => ({ taskId: e.taskId, episodeIndex: e.episodeIndex })),
    });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  const episodeIndex = Number(req.nextUrl.searchParams.get("episodeIndex") ?? 0);
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });
  const bucket = task.bucket ?? DEFAULT_BUCKET;
  const camera = primaryCamera(task.cameras);
  const videoKey = episodeVideoKey(task, episodeIndex, camera);

  if (req.nextUrl.searchParams.get("download") === "1") {
    const rangeBytes = req.nextUrl.searchParams.get("rangeBytes");
    const suffixBytes = req.nextUrl.searchParams.get("suffixBytes");
    try {
      const resp = await client().send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: videoKey,
          ...(suffixBytes
            ? { Range: `bytes=-${Number(suffixBytes)}` }
            : rangeBytes
              ? { Range: `bytes=0-${Number(rangeBytes) - 1}` }
              : {}),
        })
      );
      const webStream = resp.Body!.transformToWebStream();
      return new NextResponse(webStream, { headers: { "content-type": "video/mp4" } });
    } catch (err) {
      return NextResponse.json({ error: "fetch failed", videoKey, detail: String(err) }, { status: 404 });
    }
  }

  return NextResponse.json({
    taskId,
    episodeIndex,
    camera,
    bucket,
    videoKey,
    thumbKey: episodeThumbnailKey(task, episodeIndex),
  });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) return unauthorized();

  const taskId = req.nextUrl.searchParams.get("taskId");
  const episodeIndex = Number(req.nextUrl.searchParams.get("episodeIndex") ?? 0);
  const durationSeconds = req.nextUrl.searchParams.get("durationSeconds");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });
  const bucket = task.bucket ?? DEFAULT_BUCKET;

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength < 100) {
    return NextResponse.json({ error: "body too small, refusing to upload" }, { status: 400 });
  }

  const key = episodeThumbnailKey(task, episodeIndex);
  await client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: "image/jpeg" }));

  const updated = await prisma.episode.updateMany({
    where: { taskId: task.id, episodeIndex },
    data: {
      hasThumbnail: true,
      ...(durationSeconds ? { durationSeconds: Math.max(1, Math.round(Number(durationSeconds))) } : {}),
    },
  });

  return NextResponse.json({ taskId, episodeIndex, key, bytes: bytes.byteLength, episodesUpdated: updated.count });
}
