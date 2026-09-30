import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";

const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

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
  const bucket = req.nextUrl.searchParams.get("bucket") ?? "egocentric-gripper";
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
