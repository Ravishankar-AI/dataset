import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listObjectKeys } from "@/lib/minio";

// TEMPORARY: checking whether tasks whose DB objectPrefix has no data are
// actually just missing an "Output/" segment -- i.e. the real capture
// lives at Output/<name>/ but the catalog row points at <name>/ (no
// Output/) instead. Remove once this is resolved either way.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

    const currentPrefix = task.objectPrefix;
    const outputPrefix = currentPrefix.startsWith("Output/") ? currentPrefix : `Output/${currentPrefix}`;

    const [currentKeys, outputKeys] = await Promise.all([
      listObjectKeys(currentPrefix),
      listObjectKeys(outputPrefix),
    ]);

    return NextResponse.json({
      taskId,
      title: task.title,
      currentPrefix,
      currentKeyCount: currentKeys.length,
      outputPrefix,
      outputKeyCount: outputKeys.length,
      outputSample: outputKeys.slice(0, 10),
    });
  }

  if (req.nextUrl.searchParams.get("scan") === "1") {
    const take = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    const skip = Number(req.nextUrl.searchParams.get("skip") ?? 0);
    const tasks = await prisma.task.findMany({ take, skip, orderBy: { id: "asc" } });

    const fixable: { taskId: string; title: string; currentPrefix: string; outputPrefix: string; outputKeyCount: number }[] = [];
    const orphaned: { taskId: string; title: string; currentPrefix: string }[] = [];

    for (const t of tasks) {
      const currentKeys = await listObjectKeys(t.objectPrefix);
      if (currentKeys.length > 0) continue; // already fine, not our concern here

      const outputPrefix = t.objectPrefix.startsWith("Output/") ? t.objectPrefix : `Output/${t.objectPrefix}`;
      const outputKeys = t.objectPrefix.startsWith("Output/") ? [] : await listObjectKeys(outputPrefix);
      if (outputKeys.length > 0) {
        fixable.push({ taskId: t.id, title: t.title, currentPrefix: t.objectPrefix, outputPrefix, outputKeyCount: outputKeys.length });
      } else {
        orphaned.push({ taskId: t.id, title: t.title, currentPrefix: t.objectPrefix });
      }
    }

    return NextResponse.json({ scanned: tasks.length, fixableCount: fixable.length, orphanedCount: orphaned.length, fixable, orphaned });
  }

  // List everything directly under teleoperation/Output/ (one level) so we
  // can see the real folder names that exist there.
  const prefix = req.nextUrl.searchParams.get("prefix") ?? "Output/";
  const keys = await listObjectKeys(prefix);
  return NextResponse.json({ prefix, keyCount: keys.length, sample: keys.slice(0, 60) });
}

// Applies the objectPrefix fix for a specific set of confirmed-fixable
// task ids (pass ?taskIds=a,b,c) -- prepends "Output/" to Task.objectPrefix.
// Deliberately requires an explicit id list rather than re-running the
// scan-and-fix in one shot, so nothing gets changed without having been
// looked at first.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const idsParam = req.nextUrl.searchParams.get("taskIds");
  if (!idsParam) return NextResponse.json({ error: "taskIds required" }, { status: 400 });
  const ids = idsParam.split(",").filter(Boolean);

  const results: { taskId: string; from: string; to: string }[] = [];
  for (const id of ids) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task || task.objectPrefix.startsWith("Output/")) continue;
    const to = `Output/${task.objectPrefix}`;
    await prisma.task.update({ where: { id }, data: { objectPrefix: to } });
    results.push({ taskId: id, from: task.objectPrefix, to });
  }

  return NextResponse.json({ updated: results.length, results });
}
