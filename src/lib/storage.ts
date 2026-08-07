import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3-compatible object storage client — points at a self-hosted MinIO
 * instance backed by the NAS's own disks, not a cloud provider, per the
 * decision to avoid cloud storage/egress billing. forcePathStyle is
 * required for MinIO, which doesn't do per-bucket subdomain routing the
 * way AWS/R2 do.
 *
 * In local/dev environments without live storage credentials, signing
 * falls back to a placeholder path so pages built against this stay
 * renderable and clickable without live infrastructure.
 */

function hasStorageCredentials() {
  return Boolean(
    process.env.OBJECT_STORAGE_ENDPOINT &&
      process.env.OBJECT_STORAGE_ACCESS_KEY_ID &&
      process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY
  );
}

function client() {
  return new S3Client({
    region: process.env.OBJECT_STORAGE_REGION || "us-east-1",
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
    },
  });
}

export async function getSignedDownloadUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600
): Promise<{ url: string; isLive: boolean }> {
  if (!hasStorageCredentials()) {
    return {
      url: `/placeholder-download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`,
      isLive: false,
    };
  }

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(client(), command, { expiresIn: expiresInSeconds });
  return { url, isLive: true };
}

export function getPublicSampleUrl(key: string): { url: string; isLive: boolean } {
  const base = process.env.OBJECT_STORAGE_PUBLIC_URL;
  if (!base) {
    return {
      url: `/placeholder-download?bucket=samples&key=${encodeURIComponent(key)}`,
      isLive: false,
    };
  }
  return { url: `${base.replace(/\/$/, "")}/${key}`, isLive: true };
}
