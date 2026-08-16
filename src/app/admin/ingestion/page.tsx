import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { listIngestionQueue, getIngestionStats } from "@/lib/catalog";
import { listBucketEntries } from "@/lib/minio";
import { formatBytes, formatRelativeTime, formatDuration } from "@/lib/format";

export const metadata = { title: "Ingestion Queue — Objectways Data" };

const STATUS_STYLE: Record<string, string> = {
  queued: "text-ink-faint border-ink-faint",
  validating: "text-signal-ink border-signal-ink",
  cataloged: "text-ink border-ink",
  rejected: "text-ink-soft border-ink-soft line-through",
};

export default async function IngestionQueuePage() {
  const session = await requireRole("contributor", "admin");
  if (!session) redirect("/sign-in?next=/admin/ingestion");

  const [episodes, stats, bucket] = await Promise.all([
    listIngestionQueue(),
    getIngestionStats(),
    listBucketEntries(),
  ]);

  return (
    <div className="mx-auto max-w-[1180px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        Staff · Signed in as {session.name}
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.6rem]">Ingestion Queue</h1>
      <p className="mb-10 max-w-[62ch] text-ink-soft">
        Every episode pushed from the NAS lands here first. Validation and on-device anonymization run
        automatically; anything that fails stays visible with a reason instead of silently dropping.
      </p>

      <div className="mb-10 grid grid-cols-2 gap-5 border-y border-dashed border-line py-6 sm:grid-cols-4">
        {(["queued", "validating", "cataloged", "rejected"] as const).map((s) => (
          <div key={s}>
            <b className="block font-display text-[1.3rem] font-extrabold tabular-nums">{stats[s] ?? 0}</b>
            <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">{s}</span>
          </div>
        ))}
      </div>

      <div className="mb-10">
        <h2 className="mb-1.5 font-display text-[1.15rem] font-extrabold">NAS Bucket</h2>
        <p className="mb-4 max-w-[62ch] text-[0.85rem] text-ink-soft">
          Raw folders currently sitting in <code className="font-mono text-ink">{bucket.bucket}</code> on
          the NAS, before the ingestion worker validates and catalogs them as episodes above. Most of
          these are unreviewed capture staging, not yet fit for the catalog.
        </p>

        {!bucket.isLive && (
          <p className="border border-dashed border-line px-4 py-3 text-[0.8rem] text-ink-faint">
            MinIO credentials aren&apos;t configured (set <code className="font-mono">MINIO_ENDPOINT</code>,{" "}
            <code className="font-mono">MINIO_ACCESS_KEY</code>, <code className="font-mono">MINIO_SECRET_KEY</code>,{" "}
            <code className="font-mono">MINIO_BUCKET</code>) — nothing to list yet.
          </p>
        )}

        {bucket.isLive && bucket.entries.length === 0 && <p className="text-ink-faint">Bucket is empty.</p>}

        {bucket.isLive && bucket.entries.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
            {bucket.entries.map((entry) => (
              <div
                key={entry.prefix}
                className="truncate border-b border-dashed border-line py-1.5 font-mono text-[0.78rem] text-ink-soft"
                title={entry.name}
              >
                {entry.name}/
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              {["Episode", "Dataset", "Captured", "Duration", "Size", "Status"].map((h) => (
                <th
                  key={h}
                  className="border-b-2 border-line-strong pb-3.5 pr-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {episodes.map((e, i) => (
              <tr key={e.id}>
                <td
                  className={`py-4 pr-4 font-mono text-[0.8rem] ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                >
                  {e.objectKey.split("/").pop()}
                </td>
                <td
                  className={`py-4 pr-4 text-[0.85rem] ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                >
                  {e.dataset.title}
                </td>
                <td
                  className={`py-4 pr-4 text-[0.8rem] text-ink-faint ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                >
                  {formatRelativeTime(e.capturedAt)}
                </td>
                <td
                  className={`py-4 pr-4 font-mono text-[0.8rem] tabular-nums ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                >
                  {formatDuration(e.durationSeconds)}
                </td>
                <td
                  className={`py-4 pr-4 font-mono text-[0.8rem] tabular-nums ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                >
                  {formatBytes(e.sizeBytes)}
                </td>
                <td className={`py-4 ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}>
                  <span
                    className={`inline-block rounded-pill border px-3 py-1 font-mono text-[0.66rem] uppercase tracking-wider ${STATUS_STYLE[e.status]}`}
                  >
                    {e.status}
                  </span>
                  {e.rejectionReason && (
                    <div className="mt-1 max-w-[32ch] text-[0.72rem] text-ink-faint">{e.rejectionReason}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {episodes.length === 0 && <p className="text-ink-faint">No episodes ingested yet.</p>}
    </div>
  );
}
