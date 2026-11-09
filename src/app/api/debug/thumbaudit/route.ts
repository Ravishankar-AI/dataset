import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY: audit hasThumbnail coverage across every dataset. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const datasetSlug = req.nextUrl.searchParams.get("dataset");

  if (datasetSlug) {
    const take = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    const skip = Number(req.nextUrl.searchParams.get("skip") ?? 0);
    const episodes = await prisma.episode.findMany({
      where: { hasThumbnail: false, task: { dataset: { slug: datasetSlug } } },
      take,
      skip,
      orderBy: [{ taskId: "asc" }, { episodeIndex: "asc" }],
      select: { taskId: true, episodeIndex: true, videoKeys: true, task: { select: { title: true, bucket: true, objectPrefix: true } } },
    });
    const totalMissing = await prisma.episode.count({ where: { hasThumbnail: false, task: { dataset: { slug: datasetSlug } } } });
    return NextResponse.json({ datasetSlug, totalMissing, count: episodes.length, episodes });
  }

  const datasets = await prisma.dataset.findMany({ select: { slug: true, title: true } });
  const results: { slug: string; title: string; totalEpisodes: number; missingThumbnails: number }[] = [];
  for (const d of datasets) {
    const totalEpisodes = await prisma.episode.count({ where: { task: { dataset: { slug: d.slug } } } });
    const missingThumbnails = await prisma.episode.count({ where: { hasThumbnail: false, task: { dataset: { slug: d.slug } } } });
    results.push({ slug: d.slug, title: d.title, totalEpisodes, missingThumbnails });
  }
  return NextResponse.json({ results });
}
