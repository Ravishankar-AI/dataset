import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPublicSampleUrl } from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { PillButton } from "@/components/pill-button";

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

  const preview = getPublicSampleUrl(`${dataset.r2Prefix}preview.mp4`);

  return (
    <div className="mx-auto max-w-[820px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-signal-ink">
        {dataset.modality.name} · Sample
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.4rem]">{dataset.title}</h1>
      <p className="mb-8 max-w-[62ch] text-ink-soft">{dataset.description}</p>

      <div className="mb-8 grid grid-cols-2 gap-5 border-y border-dashed border-line py-6 sm:grid-cols-4">
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

      <div className="flex flex-wrap items-center gap-3">
        <PillButton href={preview.url} icon="play">
          Play Preview Clip
        </PillButton>
        <PillButton href="/datasets" variant="ghost" icon="arrow">
          Request the Full Dataset
        </PillButton>
      </div>
      {!preview.isLive && (
        <p className="mt-3 text-[0.72rem] text-ink-faint">
          R2 credentials aren&apos;t configured in this environment, so this links to a placeholder.
        </p>
      )}
    </div>
  );
}
