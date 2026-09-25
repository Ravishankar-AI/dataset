import { NextRequest, NextResponse } from "next/server";
import { parquetMetadataAsync, parquetSchema, type AsyncBuffer } from "hyparquet";
import { prisma } from "@/lib/db";
import { getObjectBuffer } from "@/lib/minio";
import { datasetInfoKey, episodeParquetKey } from "@/lib/lerobot";

// TEMPORARY: exploring what's actually available in real captures'
// meta/info.json + episode parquet beyond what src/lib/telemetry.ts
// currently reads (just timestamp + observation.state) -- e.g. whether
// `action` is present with the same shape (tracking-error signal), what
// other columns exist, and whether info.json declares anything about
// force/torque/velocity that isn't being surfaced. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

function bufferToAsyncBuffer(buffer: Buffer): AsyncBuffer {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  return {
    byteLength: arrayBuffer.byteLength,
    slice: (start: number, end?: number) => arrayBuffer.slice(start, end),
  };
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const infoBuf = await getObjectBuffer(datasetInfoKey(task));
  const info = infoBuf ? JSON.parse(infoBuf.toString("utf-8")) : null;

  const parquetBuf = await getObjectBuffer(episodeParquetKey(task, 0));
  let parquetColumns: string[] = [];
  let parquetRowCount = 0;
  if (parquetBuf) {
    const file = bufferToAsyncBuffer(parquetBuf);
    const metadata = await parquetMetadataAsync(file);
    const schema = parquetSchema(metadata);
    parquetColumns = schema.children.map((c) => c.element.name);
    parquetRowCount = Number(metadata.num_rows);
  }

  return NextResponse.json({
    taskId,
    title: task.title,
    infoFeatures: info?.features ? Object.keys(info.features) : null,
    infoFeatureDetail: info?.features ?? null,
    infoTopLevelKeys: info ? Object.keys(info) : null,
    parquetColumns,
    parquetRowCount,
  });
}
