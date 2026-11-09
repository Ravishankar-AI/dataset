import { NextRequest, NextResponse } from "next/server";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { prisma } from "@/lib/db";

// TEMPORARY: scan every task in a dataset for the "objectPrefix missing
// Output/ segment" bug (recurrence of the original bug fixed for 10 tasks
// at the very start of this project) -- check whether meta/info.json
// exists at the stored objectPrefix, and if not, whether prepending
// "Output/" resolves it. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";
const DEFAULT_BUCKET = process.env.MINIO_BUCKET || "teleoperation";

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

async function exists(bucket: string, key: string): Promise<boolean> {
  try {
    await rawClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const datasetSlug = req.nextUrl.searchParams.get("dataset");
  if (!datasetSlug) return NextResponse.json({ error: "dataset required" }, { status: 400 });

  const tasks = await prisma.task.findMany({
    where: { dataset: { slug: datasetSlug } },
    select: { id: true, title: true, objectPrefix: true, bucket: true },
  });

  const broken: { id: string; title: string; objectPrefix: string; fixedPrefix: string }[] = [];
  const ok: string[] = [];
  const unresolved: { id: string; title: string; objectPrefix: string }[] = [];

  async function checkTask(t: (typeof tasks)[number]) {
    const bucket = t.bucket ?? DEFAULT_BUCKET;
    if (await exists(bucket, `${t.objectPrefix}meta/info.json`)) {
      ok.push(t.id);
      return;
    }
    if (!t.objectPrefix.startsWith("Output/")) {
      const fixedPrefix = `Output/${t.objectPrefix}`;
      if (await exists(bucket, `${fixedPrefix}meta/info.json`)) {
        broken.push({ id: t.id, title: t.title, objectPrefix: t.objectPrefix, fixedPrefix });
        return;
      }
    }
    unresolved.push({ id: t.id, title: t.title, objectPrefix: t.objectPrefix });
  }

  const BATCH_SIZE = 25;
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    await Promise.all(tasks.slice(i, i + BATCH_SIZE).map(checkTask));
  }

  return NextResponse.json({ datasetSlug, totalTasks: tasks.length, okCount: ok.length, brokenCount: broken.length, broken, unresolvedCount: unresolved.length, unresolved });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const taskId = req.nextUrl.searchParams.get("taskId");
  const newPrefix = req.nextUrl.searchParams.get("newPrefix");
  if (!taskId || !newPrefix) return NextResponse.json({ error: "taskId and newPrefix required" }, { status: 400 });

  const updated = await prisma.task.update({ where: { id: taskId }, data: { objectPrefix: newPrefix } });
  return NextResponse.json({ updated: true, taskId: updated.id, objectPrefix: updated.objectPrefix });
}
