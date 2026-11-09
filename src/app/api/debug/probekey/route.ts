import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";

// TEMPORARY: probe actual video file existence/size for the standard
// LeRobot key convention, for clutter-sort / teleoperation-capture missing
// thumbnails. Remove after use.
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

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const bucket = req.nextUrl.searchParams.get("bucket") ?? DEFAULT_BUCKET;
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  try {
    const resp = await rawClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return NextResponse.json({ bucket, key, exists: true, size: resp.ContentLength });
  } catch (err) {
    return NextResponse.json({ bucket, key, exists: false, detail: String(err) });
  }
}
