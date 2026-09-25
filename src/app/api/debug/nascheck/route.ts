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

  // List everything directly under teleoperation/Output/ (one level) so we
  // can see the real folder names that exist there.
  const prefix = req.nextUrl.searchParams.get("prefix") ?? "Output/";
  const keys = await listObjectKeys(prefix);
  return NextResponse.json({ prefix, keyCount: keys.length, sample: keys.slice(0, 60) });
}
