import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDatasetForViewer } from "@/lib/catalog";
import { formatBytes } from "@/lib/format";
import { requestDownload } from "./actions";

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  const { dataset, allowed } = await getDatasetForViewer(slug, session);

  if (!dataset) notFound();
  if (!allowed) redirect(`/sign-in?next=/datasets/${slug}`);

  return (
    <div className="mx-auto max-w-[820px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-signal-ink">
        {dataset.modality.name} · Customer dataset
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
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Dataset size</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold">{dataset.modality.sensorManifest}</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Sensors</span>
        </div>
        <div>
          <b className="block font-display text-[1.1rem] font-extrabold">LeRobot</b>
          <span className="text-[0.66rem] uppercase tracking-wider text-ink-faint">Export format</span>
        </div>
      </div>

      <form action={requestDownload}>
        <input type="hidden" name="slug" value={dataset.slug} />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-pill border border-line-strong bg-line-strong px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-paper transition-colors hover:opacity-90"
        >
          Get Signed Download URL <span aria-hidden>→</span>
        </button>
      </form>
      <p className="mt-3 text-[0.72rem] text-ink-faint">
        Generates a time-limited link straight to MinIO on the NAS — the app server never proxies the file.
      </p>
    </div>
  );
}
