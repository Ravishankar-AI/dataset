import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";

// TEMPORARY: exploring egocentric-data-pool/united_states -- user wants it
// cataloged as a new category split by equipment type. Remove after use.
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

  const bucket = req.nextUrl.searchParams.get("bucket") ?? "egocentric-data-pool";
  const prefix = req.nextUrl.searchParams.get("prefix") ?? "";

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

  if (req.nextUrl.searchParams.get("recursive") === "1") {
    const all = req.nextUrl.searchParams.get("all") === "1";
    let count = 0;
    let totalSize = 0;
    let continuationToken: string | undefined;
    const sampleKeys: string[] = [];
    do {
      const resp = await rawClient().send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
      );
      for (const o of resp.Contents ?? []) {
        if (!o.Key || o.Key.endsWith("/")) continue;
        count++;
        totalSize += o.Size ?? 0;
        if (all || sampleKeys.length < 10) sampleKeys.push(o.Key);
      }
      continuationToken = resp.NextContinuationToken;
    } while (continuationToken);
    return NextResponse.json({ bucket, prefix, count, totalSize, sampleKeys });
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
