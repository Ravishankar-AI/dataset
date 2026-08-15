import { getSession } from "@/lib/auth";
import { getDatasetForViewer } from "@/lib/catalog";
import { getSignedDownloadUrl, listObjectKeys } from "@/lib/minio";

// Real datasets are many files (per-episode parquet + per-camera video), not
// a single manifest.tar — this generates a manifest of signed URLs, one per
// file, instead of trying to zip anything server-side.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const session = await getSession();

  // Re-check entitlement here too — a page-level gate isn't enough since
  // route handlers can be hit directly.
  const { dataset, allowed } = await getDatasetForViewer(slug, session);
  if (!dataset || !allowed) {
    return new Response("Not authorized", { status: 403 });
  }

  // Multi-task datasets (e.g. Teleoperation Capture) have no single shared
  // bucket prefix -- each task carries its own -- so there's no one manifest
  // to generate here. An empty objectPrefix would otherwise list the whole
  // bucket.
  if (!dataset.objectPrefix) {
    return new Response("This dataset has no single manifest — browse its tasks individually.", {
      status: 400,
    });
  }

  const keys = await listObjectKeys(dataset.objectPrefix);
  const files = await Promise.all(
    keys.map(async (key) => ({ key, url: (await getSignedDownloadUrl(key)).url }))
  );

  return new Response(JSON.stringify({ dataset: dataset.slug, files }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${dataset.slug}-manifest.json"`,
    },
  });
}
