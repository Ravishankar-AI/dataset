import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY: remove the 43 teleoperation-capture tasks confirmed to have
// no usable video data (empty "practice" folders or corrupted
// test-upload-2/3 entries) -- user asked to remove them, same as
// clutter-sort. Remove this route after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

const TASK_IDS = [
  "task_teleop_36", "task_teleop_62", "task_teleop_74", "task_teleop_88",
  "task_teleop_121", "task_teleop_114", "task_teleop_177", "task_teleop_178",
  "task_teleop_194", "task_teleop_200", "task_teleop_238", "task_teleop_256",
  "task_teleop_255", "task_teleop_277", "task_teleop_290", "task_teleop_286",
  "task_teleop_288", "task_teleop_296", "task_teleop_292", "task_teleop_318",
  "task_teleop_319", "task_teleop_324", "task_teleop_352", "task_teleop_358",
  "task_teleop_388", "task_teleop_374", "task_teleop_389", "task_teleop_377",
  "task_teleop_409", "task_teleop_393", "task_teleop_392", "task_teleop_428",
  "task_teleop_441", "task_teleop_415", "task_teleop_440", "task_teleop_458",
  "task_teleop_462", "task_teleop_463", "task_teleop_459", "task_teleop_444",
  "task_teleop_456", "task_teleop_468", "task_teleop_465",
];

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tasks = await prisma.task.findMany({
    where: { id: { in: TASK_IDS } },
    select: { id: true, title: true, objectPrefix: true, _count: { select: { episodes: true } } },
  });
  const episodeCount = await prisma.episode.count({ where: { taskId: { in: TASK_IDS } } });
  return NextResponse.json({
    requestedCount: TASK_IDS.length,
    foundCount: tasks.length,
    totalEpisodes: episodeCount,
    tasks,
  });
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (req.nextUrl.searchParams.get("confirm") !== "yes-delete-unresolved-tasks") {
    return NextResponse.json({ error: "missing confirm param" }, { status: 400 });
  }

  const episodeDelete = await prisma.episode.deleteMany({ where: { taskId: { in: TASK_IDS } } });
  const taskDelete = await prisma.task.deleteMany({ where: { id: { in: TASK_IDS } } });

  return NextResponse.json({
    deleted: true,
    episodesDeleted: episodeDelete.count,
    tasksDeleted: taskDelete.count,
  });
}
