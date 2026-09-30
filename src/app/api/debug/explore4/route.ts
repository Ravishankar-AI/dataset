import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";

// TEMPORARY: exploring the orbbec bucket -- user wants it cataloged as a
// new "Egocentric" category with metadata. Remove after use.
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

  const bucket = req.nextUrl.searchParams.get("bucket") ?? "orbbec";
  const prefix = req.nextUrl.searchParams.get("prefix") ?? "";

  if (req.nextUrl.searchParams.get("rangeKey")) {
    const key = req.nextUrl.searchParams.get("rangeKey")!;
    const bytes = Number(req.nextUrl.searchParams.get("bytes") ?? 30_000_000);
    try {
      const resp = await rawClient().send(
        new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${bytes - 1}` })
      );
      const data = await resp.Body!.transformToByteArray();
      return new NextResponse(new Uint8Array(data), { headers: { "content-type": "video/mp4" } });
    } catch (err) {
      return NextResponse.json({ error: "range fetch failed", key, detail: String(err) }, { status: 404 });
    }
  }

  if (req.nextUrl.searchParams.get("readKey")) {
    const key = req.nextUrl.searchParams.get("readKey")!;
    try {
      const resp = await rawClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await resp.Body!.transformToByteArray();
      const text = Buffer.from(bytes).toString("utf-8");
      return NextResponse.json({ bucket, key, bytes: bytes.length, text: text.slice(0, 20000) });
    } catch (err) {
      return NextResponse.json({ error: "read failed", bucket, key, detail: String(err) }, { status: 404 });
    }
  }

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
