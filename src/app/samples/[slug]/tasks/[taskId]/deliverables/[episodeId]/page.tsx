import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPublicSampleUrl } from "@/lib/minio";
import { getEpisodeForTask } from "@/lib/catalog";
import { episodeVideoKey, episodeThumbnailKey, humanizeCameraName } from "@/lib/lerobot";
import { formatDuration } from "@/lib/format";

export default async function DeliverableDetailPage({
  params,
}: {
  params: Promise<{ slug: string; taskId: string; episodeId: string }>;
}) {
  const { slug, taskId, episodeId } = await params;
  const session = await getSession();
  if (!session) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/samples/${slug}/tasks/${taskId}/deliverables/${episodeId}`)}`
    );
  }

  const dataset = await prisma.dataset.findFirst({
    where: { slug, accessTier: "sample", status: "published" },
  });
  if (!dataset) notFound();

  const episode = await getEpisodeForTask(taskId, episodeId);
  if (!episode || episode.episodeIndex == null || !episode.task) notFound();

  // The thumbnail only ever covers the primary (first) camera -- see
  // episodeThumbnailKey's doc comment -- so only that preview gets a poster.
  const posterUrl = episode.hasThumbnail
    ? (await getPublicSampleUrl(episodeThumbnailKey(episode.task!, episode.episodeIndex!))).url
    : undefined;

  const cameraPreviews = await Promise.all(
    episode.task!.cameras.map(async (camera, i) => ({
      camera,
      label: humanizeCameraName(camera),
      poster: i === 0 ? posterUrl : undefined,
      ...(await getPublicSampleUrl(episodeVideoKey(episode.task!, episode.episodeIndex!, camera))),
    }))
  );
  const anyLive = cameraPreviews.some((p) => p.isLive);

  return (
    <div className="mx-auto max-w-[1230px] px-8 py-16">
      <Link
        href={`/samples/${slug}/tasks/${taskId}`}
        className="mb-6 inline-block font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint hover:text-ink"
      >
        ← {episode.task?.title}
      </Link>
      <h1 className="mb-8 text-[2rem] sm:text-[2.4rem]">
        Episode {episode.episodeIndex}
      </h1>

      <div className="mb-8 grid grid-cols-2 gap-5 border-y border-dashed border-line py-6 sm:grid-cols-4">
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold tabular-nums">
            {formatDuration(episode.durationSeconds)}
          </b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Duration</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold">{dataset.robotType ?? "—"}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Robot type</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold">{dataset.cameraModel ?? "—"}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Camera model</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold tabular-nums">{dataset.fps}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">FPS</span>
        </div>
      </div>

      {cameraPreviews.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {cameraPreviews.map((p) => (
            <div key={p.camera}>
              <video
                src={p.url}
                poster={p.poster}
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
        <p className="text-[0.85rem] text-ink-faint">No camera preview configured for this dataset.</p>
      )}
      {!anyLive && cameraPreviews.length > 0 && (
        <p className="mt-3 text-[0.72rem] text-ink-faint">
          MinIO credentials aren&apos;t configured in this environment, so these link to a placeholder.
        </p>
      )}
    </div>
  );
}
