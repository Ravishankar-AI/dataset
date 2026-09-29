import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListBucketsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";
import { listObjectKeys, listBucketEntries } from "@/lib/minio";

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

// TEMPORARY: exploring the UMI gripper capture data at pika-sense-umi-data/
// and UMI/ in the bucket -- totally unknown format/layout, need to see it
// before designing a catalog entry or a telemetry parser for it. Remove
// after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get("listBuckets") === "1") {
    const result = await rawClient().send(new ListBucketsCommand({}));
    return NextResponse.json({ buckets: (result.Buckets ?? []).map((b) => b.Name) });
  }

  const bucket = req.nextUrl.searchParams.get("bucket");
  if (bucket) {
    const prefix = req.nextUrl.searchParams.get("prefix") ?? "";
    const result = await rawClient().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/" })
    );
    return NextResponse.json({
      bucket,
      prefix,
      commonPrefixes: (result.CommonPrefixes ?? []).map((p) => p.Prefix),
      objects: (result.Contents ?? []).map((o) => ({ key: o.Key, size: o.Size })),
    });
  }

  const prefix = req.nextUrl.searchParams.get("prefix") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 80);
  const deep = req.nextUrl.searchParams.get("deep") === "1";

  if (deep) {
    const keys = await listObjectKeys(prefix);
    return NextResponse.json({ mode: "deep", prefix, keyCount: keys.length, sample: keys.slice(0, limit) });
  }

  // Shallow (delimiter) listing by default -- listObjectKeys recurses
  // fully with no cap, which is fine for a single task's ~10 episodes but
  // could be thousands of keys for an unknown top-level prefix.
  const listing = await listBucketEntries(prefix);
  return NextResponse.json({ mode: "shallow", prefix, entryCount: listing.entries.length, entries: listing.entries.slice(0, limit) });
}
