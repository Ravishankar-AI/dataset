import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 client (S3-compatible API). R2 has zero egress fees, which
 * is why downloads are signed URLs straight from R2 rather than proxied
 * through the app server — see the architecture memo.
 *
 * In local/dev environments without real R2 credentials, signing falls
 * back to a placeholder path so pages built against this stay renderable
 * and clickable without live infrastructure.
 */

function hasR2Credentials() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  );
}

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function getSignedDownloadUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600
): Promise<{ url: string; isLive: boolean }> {
  if (!hasR2Credentials()) {
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
  const base = process.env.R2_PUBLIC_SAMPLES_URL;
  if (!base) {
    return {
      url: `/placeholder-download?bucket=samples&key=${encodeURIComponent(key)}`,
      isLive: false,
    };
  }
  return { url: `${base.replace(/\/$/, "")}/${key}`, isLive: true };
}
