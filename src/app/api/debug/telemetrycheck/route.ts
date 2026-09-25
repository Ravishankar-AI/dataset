import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadEpisodeTelemetry } from "@/lib/telemetry";

// TEMPORARY: user reported seeing no change on the live site after the
// tracking-error/video-spec/capture-totals deploy. Confirming server-side
// whether a real episode actually produces the new fields (deploy/data
// issue) vs. this being a stale page in their browser (nothing to fix).
// Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId") ?? "task_teleop_0";
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const telemetry = await loadEpisodeTelemetry(task, 0);
  if (!telemetry) return NextResponse.json({ taskId, telemetry: null });

  return NextResponse.json({
    taskId,
    title: task.title,
    trackingErrorBySide: telemetry.trackingErrorBySide,
    videoSpec: telemetry.videoSpec,
    datasetTotals: telemetry.datasetTotals,
    sampleCount: telemetry.sampleCount,
  });
}
