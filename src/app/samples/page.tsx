import { listSampleDatasets } from "@/lib/catalog";
import { formatBytes } from "@/lib/format";
import { PillButton } from "@/components/pill-button";

export const metadata = { title: "Samples — Objectways Data" };

export default async function SamplesPage() {
  const datasets = await listSampleDatasets();

  return (
    <div className="mx-auto max-w-[1180px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        Public · No login required
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.6rem]">Sample Data</h1>
      <p className="mb-12 max-w-[62ch] text-ink-soft">
        Small, watermark-free clips from every modality we capture. Enough to evaluate sensor quality and
        metadata structure before requesting a full dataset — no NDA required.
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {datasets.map((d) => (
          <div key={d.id} className="flex flex-col gap-3 border border-line bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] uppercase tracking-wider text-signal-ink">
                {d.modality.name}
              </span>
              <span className="text-[0.68rem] uppercase tracking-wider text-ink-faint">{d.version}</span>
            </div>
            <h3 className="font-display text-[1.15rem] font-extrabold">{d.title}</h3>
            <p className="text-[0.85rem] text-ink-soft">{d.description}</p>
            <div className="mt-1 flex items-center justify-between border-t border-dashed border-line pt-3.5">
              <span className="font-mono text-[0.72rem] tabular-nums text-ink-faint">
                {formatBytes(d.sizeBytes)}
              </span>
              <PillButton href={`/samples/${d.slug}`} size="small" icon="play">
                Preview
              </PillButton>
            </div>
          </div>
        ))}
      </div>

      {datasets.length === 0 && (
        <p className="text-ink-faint">No published samples yet — check back once the first campaign clears QA.</p>
      )}
    </div>
  );
}
