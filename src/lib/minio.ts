import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * MinIO client (S3-compatible API). MinIO runs as an app on the QNAP NAS
 * itself — its storage backend is the NAS's own disk, so there's no
 * separate NAS-to-object-store copy step. The NAS is reachable over the
 * internet through the QNAP's reverse proxy (valid Let's Encrypt cert), so
 * downloads are signed URLs straight from MinIO — the app server never
 * proxies file bytes.
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
