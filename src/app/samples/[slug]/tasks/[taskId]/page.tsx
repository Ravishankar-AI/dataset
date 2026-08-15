import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getTaskForDataset, listEpisodesForTask } from "@/lib/catalog";
import { formatDuration } from "@/lib/format";

export default async function TaskDeliverablesPage({
  params,
}: {
  params: Promise<{ slug: string; taskId: string }>;
}) {
  const { slug, taskId } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/samples/${slug}/tasks/${taskId}`)}`);

  const dataset = await prisma.dataset.findFirst({
    where: { slug, accessTier: "sample", status: "published" },
    select: { id: true, title: true, robotType: true, cameraModel: true },
  });
  if (!dataset) notFound();

  const task = await getTaskForDataset(dataset.id, taskId);
  if (!task) notFound();

  const episodes = await listEpisodesForTask(task.id);

  return (
    <div className="mx-auto max-w-[1230px] px-8 py-16">
      <Link
        href={`/samples/${slug}`}
        className="mb-6 inline-block font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint hover:text-ink"
      >
        ← {dataset.title}
      </Link>
      <h1 className="mb-2 text-[2rem] sm:text-[2.4rem]">{task.title}</h1>
      <p className="mb-10 text-[0.85rem] text-ink-faint">
        {episodes.length} deliverable{episodes.length === 1 ? "" : "s"}
      </p>

      {episodes.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {episodes.map((e) => (
            <Link
              key={e.id}
              href={`/samples/${slug}/tasks/${taskId}/deliverables/${e.id}`}
              className="block border border-line bg-card p-4 transition-colors hover:border-line-strong"
            >
              <div className="mb-2 font-mono text-[0.68rem] uppercase tracking-wider text-signal-ink">
                Episode {e.episodeIndex}
              </div>
              <div className="mb-2.5 font-mono text-[0.82rem] tabular-nums">
                {formatDuration(e.durationSeconds)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dataset.robotType && (
                  <span className="rounded-pill border border-signal-ink px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-signal-ink">
                    {dataset.robotType}
                  </span>
                )}
                {dataset.cameraModel && (
                  <span className="rounded-pill border border-signal-ink px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-signal-ink">
                    {dataset.cameraModel}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[0.85rem] text-ink-faint">No deliverables cataloged for this task yet.</p>
      )}
    </div>
  );
}
