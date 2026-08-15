import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "node:https";

/**
 * NAS client (S3-compatible / MinIO API) for the push-only capture staging
 * bucket. This only lists what's currently sitting on the NAS so staff can
 * see it land in the Uploads door — it does not write Episode/Dataset rows.
 * Turning a NAS entry into a cataloged Episode is the ingestion worker's
 * job (see README "Ingestion worker" section), a separate service.
 *
 * In local/dev environments without real NAS credentials, listing returns
 * an empty, non-live result so pages built against this stay renderable.
 */

function hasNasCredentials() {
  return Boolean(
    process.env.NAS_ENDPOINT &&
      process.env.NAS_ACCESS_KEY_ID &&
      process.env.NAS_SECRET_ACCESS_KEY &&
      process.env.NAS_BUCKET
  );
}

function client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.NAS_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.NAS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.NAS_SECRET_ACCESS_KEY!,
    },
    // The NAS terminates TLS with a self-signed cert on the internal
    // network; only skip verification when explicitly opted into.
    ...(process.env.NAS_TLS_INSECURE === "true"
      ? {
          requestHandler: new NodeHttpHandler({
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          }),
        }
      : {}),
  });
}

export type NasEntry = {
  name: string;
  prefix: string;
};

export type NasInventory = {
  bucket: string;
  entries: NasEntry[];
  isLive: boolean;
};

/**
 * Lists the immediate sub-folders under `prefix` in the NAS bucket
 * (non-recursive, like `mc ls` / the S3 console) using the delimiter-based
 * listing so buckets with tens of thousands of objects stay cheap to page.
 */
export async function listNasInventory(prefix = ""): Promise<NasInventory> {
  const bucket = process.env.NAS_BUCKET ?? "";

  if (!hasNasCredentials()) {
    return { bucket, entries: [], isLive: false };
  }

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Delimiter: "/",
    Prefix: prefix,
  });
  const result = await client().send(command);

  const entries = (result.CommonPrefixes ?? [])
    .map((p) => p.Prefix ?? "")
    .filter(Boolean)
    .map((p) => ({ prefix: p, name: p.slice(prefix.length).replace(/\/$/, "") }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { bucket, entries, isLive: true };
}
