import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublicSampleUrl } from "@/lib/minio";
import { episodeVideoKey, humanizeCameraName } from "@/lib/lerobot";
import { formatBytes } from "@/lib/format";
import { PillButton } from "@/components/pill-button";

// Every sample dataset previews the same fixed episode, across all of its
// cameras — real datasets have one video file per camera per episode, not
// a single preview.mp4.
const PREVIEW_EPISODE_INDEX = 0;

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dataset = await prisma.dataset.findFirst({
    where: { slug, accessTier: "sample", status: "published" },
    include: { modality: true },
  });
  if (!dataset) notFound();

  const cameraPreviews = await Promise.all(
    dataset.cameras.map(async (camera) => ({
      camera,
      label: humanizeCameraName(camera),
      ...(await getPublicSampleUrl(episodeVideoKey(dataset, PREVIEW_EPISODE_INDEX, camera))),
    }))
  );
  const anyLive = cameraPreviews.some((p) => p.isLive);

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
          <b className="block font-display text-[1.1rem] font-extrabold">Public</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Access</span>
        </div>
      </div>

      {cameraPreviews.length > 0 ? (
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {cameraPreviews.map((p) => (
            <div key={p.camera}>
              <video
                src={p.url}
                controls
                muted
                className="aspect-video w-full rounded border border-line bg-line-strong"
              />
              <div className="mt-2 text-center text-[0.7rem] uppercase tracking-wider text-ink-faint">
                {p.label}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-8 text-[0.85rem] text-ink-faint">No camera preview configured for this dataset.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <PillButton href="/datasets" variant="ghost" icon="arrow">
          Request the Full Dataset
        </PillButton>
      </div>
      {!anyLive && cameraPreviews.length > 0 && (
        <p className="mt-3 text-[0.72rem] text-ink-faint">
          MinIO credentials aren&apos;t configured in this environment, so these link to a placeholder.
        </p>
      )}
    </div>
  );
}
