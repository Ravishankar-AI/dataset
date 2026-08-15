import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";

/**
 * MinIO client (S3-compatible API). MinIO runs as an app on the QNAP NAS
 * itself — its storage backend is the NAS's own disk, so there's no
 * separate NAS-to-object-store copy step. The NAS is reachable over the
 * internet through the QNAP's reverse proxy, so downloads are signed URLs
 * straight from MinIO — the app server never proxies file bytes.
 *
 * Everything lives in one bucket (`MINIO_BUCKET`, "teleoperation" in
 * production) — there's no separate public/CDN-fronted bucket, so public
 * sample clips use a long-lived signed URL rather than a public base URL.
 *
 * In local/dev environments without MinIO credentials configured, signing
 * falls back to a placeholder path so pages stay renderable and clickable
 * without live infrastructure.
 */

const BUCKET = process.env.MINIO_BUCKET || "teleoperation";

// Presigned URL expiry is capped at 7 days by SigV4 — used for public
// sample clips since MinIO isn't fronted by a separate public/CDN bucket.
const SAMPLE_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

function hasMinioCredentials() {
  return Boolean(
    process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY
  );
}

function client() {
  return new S3Client({
    region: "us-east-1", // unused by MinIO, required by the SDK
    endpoint: process.env.MINIO_ENDPOINT,
    forcePathStyle: true, // MinIO serves buckets at /bucket/key, not bucket.host
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    // The QNAP reverse proxy's cert chain is currently incomplete (confirmed
    // via `openssl s_client -showcerts` — it serves the leaf cert but not
    // the Let's Encrypt intermediate), which fails strict TLS verification.
    // Fix that at the reverse proxy rather than leaving this on long-term;
    // it's an escape hatch, not the real fix.
    ...(process.env.MINIO_TLS_INSECURE === "true"
      ? {
          requestHandler: new NodeHttpHandler({
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          }),
        }
      : {}),
  });
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<{ url: string; isLive: boolean }> {
  if (!hasMinioCredentials()) {
    return {
      url: `/placeholder-download?bucket=${encodeURIComponent(BUCKET)}&key=${encodeURIComponent(key)}`,
      isLive: false,
    };
  }

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const url = await getSignedUrl(client(), command, { expiresIn: expiresInSeconds });
  return { url, isLive: true };
}

export function getPublicSampleUrl(key: string): Promise<{ url: string; isLive: boolean }> {
  return getSignedDownloadUrl(key, SAMPLE_URL_TTL_SECONDS);
}

// Unlike getSignedDownloadUrl (pure local computation, no network call),
// this and listBucketEntries make a real request to MinIO — see the TLS
// chain note on client() above.
export async function listObjectKeys(prefix: string): Promise<string[]> {
  if (!hasMinioCredentials()) return [];

  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await client().send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of response.Contents ?? []) {
      if (obj.Key && !obj.Key.endsWith("/")) keys.push(obj.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

export type BucketEntry = {
  name: string;
  prefix: string;
};

export type BucketListing = {
  bucket: string;
  entries: BucketEntry[];
  isLive: boolean;
};

/**
 * Lists the immediate sub-folders under `prefix` (non-recursive, like
 * `mc ls` / the S3 console) using delimiter-based listing so a bucket with
 * tens of thousands of objects stays cheap to page. Used for the raw
 * capture-staging browser on /uploads — separate from listObjectKeys,
 * which recurses fully for a specific dataset's download manifest.
 */
export async function listBucketEntries(prefix = ""): Promise<BucketListing> {
  if (!hasMinioCredentials()) {
    return { bucket: BUCKET, entries: [], isLive: false };
  }

  const result = await client().send(
    new ListObjectsV2Command({ Bucket: BUCKET, Delimiter: "/", Prefix: prefix })
  );

  const entries = (result.CommonPrefixes ?? [])
    .map((p) => p.Prefix ?? "")
    .filter(Boolean)
    .map((p) => ({ prefix: p, name: p.slice(prefix.length).replace(/\/$/, "") }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { bucket: BUCKET, entries, isLive: true };
}
