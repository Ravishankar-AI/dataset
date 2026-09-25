import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { episodeThumbnailKey } from "@/lib/lerobot";
import { listObjectKeys } from "@/lib/minio";

// TEMPORARY diagnostic route for investigating broken thumbnail cards on
// /samples/[slug] — checks episodes flagged hasThumbnail=true against what
// actually exists in MinIO, since only the app server can reach both
// postgres.railway.internal and nas.objectways.com. Gated on a one-off
// secret rather than a real session so it can be curled directly. Remove
// this whole route once the investigation is done.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 60);
  const titleContains = req.nextUrl.searchParams.get("q") ?? undefined;

  const tasks = await prisma.task.findMany({
    where: titleContains ? { title: { contains: titleContains, mode: "insensitive" } } : undefined,
    take: limit,
    include: { episodes: { where: { episodeIndex: 0 }, take: 1 } },
  });

  const results: { taskId: string; title: string; key: string; existsInBucket: boolean; siblingCount: number }[] = [];
  for (const t of tasks) {
    const ep = t.episodes[0];
    if (!ep?.hasThumbnail) continue;
    const key = episodeThumbnailKey(t, 0);
    const prefix = key.split("/").slice(0, -1).join("/") + "/";
    const siblings = await listObjectKeys(prefix);
    results.push({
      taskId: t.id,
      title: t.title,
      key,
      existsInBucket: siblings.includes(key),
      siblingCount: siblings.length,
    });
  }

  return NextResponse.json({
    checkedTasks: tasks.length,
    checkedWithThumbnailFlag: results.length,
    missing: results.filter((r) => !r.existsInBucket),
    ok: results.filter((r) => r.existsInBucket).length,
  });
}
