import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listDeliverablesForDataset, getCameraCountBreakdown } from "@/lib/catalog";
import { formatBytes, formatDuration } from "@/lib/format";
import { episodeThumbnailKey } from "@/lib/lerobot";
import { getPublicSampleUrl } from "@/lib/minio";

const PAGE_SIZE = 24;
const CAMERA_BUCKETS = [1, 2, 3, 6];

type SearchParams = {
  q?: string;
  durationMin?: string;
  durationMax?: string;
  cams?: string | string[];
  view?: string;
  page?: string;
};

function toHref(slug: string, params: SearchParams, overrides: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  const cams = Array.isArray(params.cams) ? params.cams : params.cams ? [params.cams] : [];
  if (params.q) qs.set("q", params.q);
  if (params.durationMin) qs.set("durationMin", params.durationMin);
  if (params.durationMax) qs.set("durationMax", params.durationMax);
  cams.forEach((c) => qs.append("cams", c));
  if (params.view) qs.set("view", params.view);
  if (params.page) qs.set("page", params.page);

  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) qs.delete(key);
    else qs.set(key, String(value));
  }

  const query = qs.toString();
  return `/samples/${slug}${query ? `?${query}` : ""}`;
}

export default async function SampleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/samples/${slug}`)}`);

  const dataset = await prisma.dataset.findFirst({
    where: { slug, accessTier: "sample", status: "published" },
    include: { modality: true },
  });
  if (!dataset) notFound();

  const search = sp.q?.trim() || undefined;
  const durationMin = sp.durationMin ? Number(sp.durationMin) : undefined;
  const durationMax = sp.durationMax ? Number(sp.durationMax) : undefined;
  const selectedCams = (Array.isArray(sp.cams) ? sp.cams : sp.cams ? [sp.cams] : [])
    .map(Number)
    .filter((n) => CAMERA_BUCKETS.includes(n));
  const view = sp.view === "rows" ? "rows" : "cards";
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ episodes, total }, cameraBreakdown] = await Promise.all([
    listDeliverablesForDataset(dataset.id, {
      search,
      durationMin: Number.isFinite(durationMin) ? durationMin : undefined,
      durationMax: Number.isFinite(durationMax) ? durationMax : undefined,
      cameraCounts: selectedCams.length > 0 ? selectedCams : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    getCameraCountBreakdown(dataset.id),
  ]);

  const isFiltered = Boolean(search || sp.durationMin || sp.durationMax || selectedCams.length > 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Signing is pure local HMAC computation (no network call), so resolving
  // a URL per thumbnail here is cheap even for a full page of cards.
  const thumbnailUrls = new Map<string, string>();
  if (view === "cards") {
    await Promise.all(
      episodes
        .filter((e) => e.hasThumbnail && e.task)
        .map(async (e) => {
          const { url } = await getPublicSampleUrl(episodeThumbnailKey(e.task!, e.episodeIndex ?? 0));
          thumbnailUrls.set(e.id, url);
        })
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] px-8 py-16">
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

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <form className="flex flex-col gap-5 border border-line bg-paper-alt p-5">
            <div className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Filter</div>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.66rem] uppercase tracking-wider text-ink-faint">Task name</span>
              <input
                type="text"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="e.g. folding, cutlery&hellip;"
                className="border border-line bg-card px-3 py-2 text-[0.85rem]"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.66rem] uppercase tracking-wider text-ink-faint">
                Duration (seconds)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="durationMin"
                  min={0}
                  defaultValue={sp.durationMin ?? ""}
                  placeholder="Min"
                  className="w-full border border-line bg-card px-3 py-2 text-[0.85rem]"
                />
                <span className="text-ink-faint">–</span>
                <input
                  type="number"
                  name="durationMax"
                  min={0}
                  defaultValue={sp.durationMax ?? ""}
                  placeholder="Max"
                  className="w-full border border-line bg-card px-3 py-2 text-[0.85rem]"
                />
              </div>
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="font-mono text-[0.66rem] uppercase tracking-wider text-ink-faint">
                Camera count
              </legend>
              {CAMERA_BUCKETS.map((n) => {
                const bucket = cameraBreakdown.find((b) => b.cameraCount === n);
                if (!bucket) return null;
                return (
                  <label key={n} className="flex items-center gap-2 text-[0.82rem]">
                    <input type="checkbox" name="cams" value={n} defaultChecked={selectedCams.includes(n)} />
                    {n} <span className="font-mono text-[0.7rem] text-ink-faint">&times;{bucket.count}</span>
                  </label>
                );
              })}
            </fieldset>

            <button
              type="submit"
              className="rounded-pill border border-line-strong bg-signal px-4 py-2.5 font-mono text-[0.72rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
            >
              Apply filters
            </button>
            {isFiltered && (
              <Link
                href={`/samples/${slug}`}
                className="text-center font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint hover:text-ink"
              >
                Reset filters
              </Link>
            )}
          </form>
        </aside>

        <main>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <p className="text-[0.85rem] text-ink-soft">
              Showing <b className="text-ink">{episodes.length}</b> of <b className="text-ink">{total}</b>{" "}
              deliverable{total === 1 ? "" : "s"}
            </p>
            <div className="inline-flex border border-line">
              <Link
                href={toHref(slug, sp, { view: undefined, page: undefined })}
                className={`px-3.5 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider ${
                  view === "cards" ? "bg-line-strong text-paper" : "text-ink-faint hover:text-ink"
                }`}
              >
                Cards
              </Link>
              <Link
                href={toHref(slug, sp, { view: "rows", page: undefined })}
                className={`px-3.5 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider ${
                  view === "rows" ? "bg-line-strong text-paper" : "text-ink-faint hover:text-ink"
                }`}
              >
                Rows
              </Link>
            </div>
          </div>

          {episodes.length === 0 ? (
            <p className="border border-dashed border-line px-5 py-10 text-center text-[0.85rem] text-ink-faint">
              No deliverables match these filters.
            </p>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {episodes.map((e) => (
                <Link
                  key={e.id}
                  href={`/samples/${slug}/tasks/${e.taskId}/deliverables/${e.id}`}
                  className="block border border-line bg-card p-4 transition-colors hover:border-line-strong"
                >
                  <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded border border-line bg-paper-alt">
                    {thumbnailUrls.has(e.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed MinIO URL, not a local/optimizable asset
                      <img src={thumbnailUrls.get(e.id)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        className="h-7 w-7 text-ink-faint opacity-60"
                      >
                        <rect x="2.5" y="6" width="14" height="12" rx="2" />
                        <path d="M16.5 10l5-3v10l-5-3z" />
                      </svg>
                    )}
                  </div>
                  <h3 className="mb-2 line-clamp-2 font-display text-[0.88rem] font-extrabold leading-snug">
                    {e.task?.title}
                  </h3>
                  <div className="mb-2.5 flex items-center justify-between font-mono text-[0.72rem] text-ink-faint">
                    <span>Ep {String(e.episodeIndex ?? 0).padStart(3, "0")}</span>
                    <span className="tabular-nums text-signal-ink">{formatDuration(e.durationSeconds)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {e.task?.cameras.map((c) => (
                      <span
                        key={c}
                        className="rounded-pill border border-line px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft"
                      >
                        {c.split(".").pop()}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    {["Task", "Episode", "Duration", "Cameras"].map((h) => (
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
                        className={`max-w-[36ch] py-3.5 pr-4 text-[0.82rem] ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        <Link href={`/samples/${slug}/tasks/${e.taskId}/deliverables/${e.id}`} className="hover:underline">
                          {e.task?.title}
                        </Link>
                      </td>
                      <td
                        className={`py-3.5 pr-4 font-mono text-[0.78rem] text-ink-faint ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        {String(e.episodeIndex ?? 0).padStart(3, "0")}
                      </td>
                      <td
                        className={`py-3.5 pr-4 font-mono text-[0.78rem] tabular-nums text-signal-ink ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        {formatDuration(e.durationSeconds)}
                      </td>
                      <td className={`py-3.5 text-[0.78rem] text-ink-soft ${i === episodes.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}>
                        {e.task?.cameras.map((c) => c.split(".").pop()).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between font-mono text-[0.72rem] uppercase tracking-wider">
              {page > 1 ? (
                <Link href={toHref(slug, sp, { page: page - 1 })} className="text-ink hover:text-signal-ink">
                  ← Prev
                </Link>
              ) : (
                <span className="text-ink-faint">← Prev</span>
              )}
              <span className="text-ink-faint">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={toHref(slug, sp, { page: page + 1 })} className="text-ink hover:text-signal-ink">
                  Next →
                </Link>
              ) : (
                <span className="text-ink-faint">Next →</span>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
