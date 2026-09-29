import { NextRequest, NextResponse } from "next/server";
import { listObjectKeys, listBucketEntries } from "@/lib/minio";

// TEMPORARY: exploring the UMI gripper capture data at pika-sense-umi-data/
// and UMI/ in the bucket -- totally unknown format/layout, need to see it
// before designing a catalog entry or a telemetry parser for it. Remove
// after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const prefix = req.nextUrl.searchParams.get("prefix") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 80);
  const deep = req.nextUrl.searchParams.get("deep") === "1";

  if (deep) {
    const keys = await listObjectKeys(prefix);
    return NextResponse.json({ mode: "deep", prefix, keyCount: keys.length, sample: keys.slice(0, limit) });
  }

  // Shallow (delimiter) listing by default -- listObjectKeys recurses
  // fully with no cap, which is fine for a single task's ~10 episodes but
  // could be thousands of keys for an unknown top-level prefix.
  const listing = await listBucketEntries(prefix);
  return NextResponse.json({ mode: "shallow", prefix, entryCount: listing.entries.length, entries: listing.entries.slice(0, limit) });
}
