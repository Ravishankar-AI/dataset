import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDatasetForViewer } from "@/lib/catalog";
import { formatBytes } from "@/lib/format";
import { requestPurchase } from "../actions";

export default async function DatasetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ requested?: string }>;
}) {
  const { slug } = await params;
  const { requested } = await searchParams;
  const session = await getSession();
  const { dataset, allowed } = await getDatasetForViewer(slug, session);

  if (!dataset) notFound();
  if (!session) redirect(`/sign-in?next=/datasets/${slug}`);

  const statStrip = (
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
  );

  if (!allowed) {
    if (dataset.accessTier !== "customer") notFound();

    return (
      <div className="mx-auto max-w-[820px] px-8 py-16">
        <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-signal-ink">
          {dataset.modality.name} · Available to purchase
        </div>
        <h1 className="mb-4 text-[2rem] sm:text-[2.4rem]">{dataset.title}</h1>
        <p className="mb-8 max-w-[62ch] text-ink-soft">{dataset.description}</p>

        {statStrip}

        {requested && (
          <div className="mb-6 border border-signal-ink bg-signal-soft px-5 py-4 text-[0.85rem] text-signal-ink">
            Purchase request sent — we&apos;ll follow up by email to arrange access.
          </div>
        )}

        <div className="border border-line bg-card p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="font-display text-[1.4rem] font-extrabold">
              {dataset.priceLabel ?? "Contact for pricing"}
            </span>
            <span className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">Per organization</span>
          </div>
          <p className="mb-5 text-[0.82rem] text-ink-soft">
            {session.organizationName
              ? `Not yet licensed to ${session.organizationName}.`
              : "Your account isn't attached to an organization, so this can't be requested yet — reach out to us directly."}{" "}
            Requesting sends your details to our team, who&apos;ll follow up by email to arrange payment and
            access — nothing is charged automatically.
          </p>
          {session.organizationId ? (
            <form action={requestPurchase}>
              <input type="hidden" name="datasetId" value={dataset.id} />
              <input type="hidden" name="next" value={`/datasets/${slug}`} />
              <button
                type="submit"
                className="rounded-pill border border-line-strong bg-signal px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
              >
                Request Purchase
              </button>
            </form>
          ) : (
            <span className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
              No organization on file
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[820px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-signal-ink">
        {dataset.modality.name} · Customer dataset
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.4rem]">{dataset.title}</h1>
      <p className="mb-8 max-w-[62ch] text-ink-soft">{dataset.description}</p>

      {statStrip}

      {dataset.objectPrefix ? (
        <>
          <a
            href={`/datasets/${dataset.slug}/manifest`}
            className="inline-flex items-center gap-2 rounded-pill border border-line-strong bg-line-strong px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-paper transition-colors hover:opacity-90"
          >
            Get Download Manifest <span aria-hidden>→</span>
          </a>
          <p className="mt-3 text-[0.72rem] text-ink-faint">
            Generates a manifest of time-limited links to every file in this dataset, straight from MinIO on
            the NAS — the app server never proxies file bytes or zips anything server-side.
          </p>
        </>
      ) : (
        <p className="text-[0.72rem] text-ink-faint">
          This dataset groups many tasks, each from its own capture folder — browse its tasks from the
          samples page instead of a single dataset-wide manifest.
        </p>
      )}
    </div>
  );
}
