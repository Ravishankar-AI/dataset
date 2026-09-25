import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { episodeThumbnailKey } from "@/lib/lerobot";
import { listObjectKeys } from "@/lib/minio";

// TEMPORARY diagnostic + fix route for broken thumbnail cards on
// /samples/[slug] — some tasks have hasThumbnail=true in the DB (set by
// prisma/manual-seed.sql) even though no thumbnail object, or nothing at
// all, actually exists under their objectPrefix in MinIO. That renders as
// a raw browser broken-image icon rather than the app's own placeholder,
// because the <img> tag gets a real signed URL that 404s.
//
// Only the app server can reach both postgres.railway.internal and
// nas.objectways.com, so the check (and the fix) run from here rather
// than from the sandbox. Gated on a one-off secret instead of a real
// session so it can be curled directly. Remove this whole route once the
// investigation and fix are done — not meant to stay.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

async function findMissing(titleContains: string | undefined, take: number, skip: number) {
  const tasks = await prisma.task.findMany({
    where: titleContains ? { title: { contains: titleContains, mode: "insensitive" } } : undefined,
    take,
    skip,
    orderBy: { id: "asc" },
    include: { episodes: { where: { hasThumbnail: true } } },
  });

  const missingTaskIds: string[] = [];
  const details: { taskId: string; title: string; key: string; episodesFlagged: number }[] = [];
  for (const t of tasks) {
    if (t.episodes.length === 0) continue;
    const key = episodeThumbnailKey(t, t.episodes[0].episodeIndex ?? 0);
    const prefix = key.split("/").slice(0, -1).join("/") + "/";
    const siblings = await listObjectKeys(prefix);
    if (siblings.length === 0) {
      missingTaskIds.push(t.id);
      details.push({ taskId: t.id, title: t.title, key, episodesFlagged: t.episodes.length });
    }
  }
  return { scannedTasks: tasks.length, missingTaskIds, details };
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const countOnly = req.nextUrl.searchParams.get("countOnly") === "true";
  if (countOnly) {
    const totalTasks = await prisma.task.count();
    const totalEpisodesFlagged = await prisma.episode.count({ where: { hasThumbnail: true } });
    const totalEpisodes = await prisma.episode.count();
    return NextResponse.json({ totalTasks, totalEpisodes, totalEpisodesFlagged });
  }

  const take = Number(req.nextUrl.searchParams.get("limit") ?? 60);
  const skip = Number(req.nextUrl.searchParams.get("skip") ?? 0);
  const titleContains = req.nextUrl.searchParams.get("q") ?? undefined;

  const { scannedTasks, missingTaskIds, details } = await findMissing(titleContains, take, skip);
  return NextResponse.json({ scannedTasks, missingCount: missingTaskIds.length, missing: details });
}

// Flips hasThumbnail off for every episode belonging to a task whose
// thumbnail prefix has zero objects in the bucket — confirmed empty, not
// just "this one file 404s", so this can't accidentally hide a thumbnail
// that's merely named differently than expected. Scans in the same
// paginated way as GET; pass ?limit&skip to cover the whole catalog in
// batches, same as the read side.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const take = Number(req.nextUrl.searchParams.get("limit") ?? 60);
  const skip = Number(req.nextUrl.searchParams.get("skip") ?? 0);
  const titleContains = req.nextUrl.searchParams.get("q") ?? undefined;

  const { scannedTasks, missingTaskIds, details } = await findMissing(titleContains, take, skip);
  if (missingTaskIds.length === 0) {
    return NextResponse.json({ scannedTasks, fixedTasks: 0, fixedEpisodes: 0 });
  }

  const result = await prisma.episode.updateMany({
    where: { taskId: { in: missingTaskIds }, hasThumbnail: true },
    data: { hasThumbnail: false },
  });

  return NextResponse.json({
    scannedTasks,
    fixedTasks: missingTaskIds.length,
    fixedEpisodes: result.count,
    fixedTaskDetails: details,
  });
}
