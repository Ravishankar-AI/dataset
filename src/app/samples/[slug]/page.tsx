import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listTasksForDataset } from "@/lib/catalog";
import { formatBytes } from "@/lib/format";

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/samples/${slug}`)}`);

  const dataset = await prisma.dataset.findFirst({
    where: { slug, accessTier: "sample", status: "published" },
    include: { modality: true },
  });
  if (!dataset) notFound();

  const tasks = await listTasksForDataset(dataset.id);

  return (
    <div className="mx-auto max-w-[1230px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-signal-ink">
        {dataset.modality.name} · Sample
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.4rem]">{dataset.title}</h1>
      <p className="mb-8 max-w-[62ch] text-ink-soft">{dataset.description}</p>

      <div className="mb-10 grid grid-cols-2 gap-5 border-y border-dashed border-line py-6 sm:grid-cols-4">
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold tabular-nums">{dataset.version}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Version</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold tabular-nums">
            {formatBytes(dataset.sizeBytes)}
          </b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Sample size</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold">{dataset.modality.sensorManifest}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Sensors</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold">Account</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Access</span>
        </div>
      </div>

      <h2 className="mb-1.5 font-display text-[1.15rem] font-extrabold">Tasks</h2>
      <p className="mb-5 text-[0.85rem] text-ink-soft">
        Datasets are grouped by the instruction each episode demonstrates.
      </p>

      {tasks.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={`/samples/${slug}/tasks/${t.id}`}
              className="block border border-line bg-card p-6 transition-colors hover:border-line-strong"
            >
              <h3 className="mb-1.5 font-display text-[1.05rem] font-extrabold">{t.title}</h3>
              <span className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
                {t._count.episodes} deliverable{t._count.episodes === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[0.85rem] text-ink-faint">No tasks cataloged for this dataset yet.</p>
      )}
    </div>
  );
}
