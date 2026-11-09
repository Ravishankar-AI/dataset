import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY: inspect/remove the clutter-sort dataset, whose 102 episodes
// have no backing video files in storage (confirmed via probekey -- the
// Clutter_sort/ prefix is entirely empty in the bucket). User asked to
// remove it since the source footage was never actually uploaded. Remove
// this route after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dataset = await prisma.dataset.findUnique({
    where: { slug: "clutter-sort" },
    include: { modality: true, tasks: { include: { _count: { select: { episodes: true } } } } },
  });
  if (!dataset) return NextResponse.json({ error: "clutter-sort not found" });

  const siblingDatasets = await prisma.dataset.count({ where: { modalityId: dataset.modalityId, slug: { not: "clutter-sort" } } });

  return NextResponse.json({
    dataset: { id: dataset.id, slug: dataset.slug, title: dataset.title, modality: dataset.modality.name },
    tasks: dataset.tasks.map((t) => ({ id: t.id, title: t.title, episodeCount: t._count.episodes })),
    siblingDatasetsInSameModality: siblingDatasets,
  });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (req.nextUrl.searchParams.get("confirm") !== "yes-delete-clutter-sort") {
    return NextResponse.json({ error: "missing confirm param" }, { status: 400 });
  }

  const dataset = await prisma.dataset.findUnique({ where: { slug: "clutter-sort" } });
  if (!dataset) return NextResponse.json({ error: "clutter-sort not found" });

  const episodeDelete = await prisma.episode.deleteMany({ where: { datasetId: dataset.id } });
  const taskDelete = await prisma.task.deleteMany({ where: { datasetId: dataset.id } });
  await prisma.dataset.delete({ where: { id: dataset.id } });

  return NextResponse.json({
    deleted: true,
    episodesDeleted: episodeDelete.count,
    tasksDeleted: taskDelete.count,
    datasetDeleted: dataset.slug,
  });
}
