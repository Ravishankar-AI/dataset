import { PillButton } from "@/components/pill-button";
import { StatStrip } from "@/components/stat-strip";
import { HeroDiagram } from "@/components/hero-diagram";
import { DoorCard } from "@/components/door-card";
import { ModalityTable } from "@/components/modality-table";
import { PipelineDiagram } from "@/components/pipeline-diagram";
import { listModalities } from "@/lib/catalog";

const STEPS = [
  { num: "01", title: "Capture", body: "Rigs write raw episodes to an internal NAS — never exposed to the internet." },
  { num: "02", title: "Validate", body: "An ingestion worker checks each episode, anonymizes faces, and rejects bad captures." },
  { num: "03", title: "Catalog", body: "Passing episodes push to R2 and register in the dataset catalog with full sensor metadata." },
  { num: "04", title: "Access", body: "Samples, Uploads, and Datasets each read the same catalog, filtered to what you're allowed to see." },
];

export default async function HomePage() {
  const modalities = await listModalities();

  return (
    <>
      <section className="bracketed pb-20 pt-24">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 px-8 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
              Real-world data infrastructure for physical AI
            </div>
            <h1 className="my-4 text-[2.3rem] leading-[1.04] sm:text-[3.2rem] lg:text-[3.85rem]">
              Robot training data,
              <br />
              from <span className="text-signal-ink">capture</span> to{" "}
              <span className="text-signal-ink">catalog</span>.
            </h1>
            <p className="mb-7 max-w-[62ch] text-[0.98rem] text-ink-soft">
              Objectways Data turns footage from our capture rigs into structured, licensed datasets for
              embodied-AI teams. Every episode is validated, tagged by modality and sensor manifest, and
              served from one catalog — whether you&apos;re browsing free samples or pulling a licensed
              dataset by API.
            </p>
            <div className="mb-10 flex flex-wrap gap-3">
              <PillButton href="/samples" icon="play">
                Browse Sample Data
              </PillButton>
              <PillButton href="/#labs" variant="ghost" icon="arrow">
                Request Dataset Access
              </PillButton>
            </div>
            <StatStrip
              stats={[
                { value: "6", label: "Capture Modalities" },
                { value: "3", label: "Access Tiers" },
                { value: "10TB+", label: "Cataloged Today" },
                { value: "<24h", label: "NAS to Signed URL" },
              ]}
            />
          </div>
          <HeroDiagram />
        </div>
      </section>

      <section id="doors" className="border-y border-line bg-paper-alt py-20">
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-soft">
                One catalog, three doors
              </div>
              <h2 className="section-title mt-2 text-[1.7rem] sm:text-[2.35rem]">
                The same dataset registry,
                <br />
                filtered by who&apos;s asking.
              </h2>
            </div>
            <p className="max-w-[62ch] text-ink-soft">
              Samples, Uploads, and Datasets aren&apos;t separate systems — they&apos;re access-level views
              over one pipeline, so an episode captured today can move from staging to a customer&apos;s
              signed URL without ever being re-copied or re-tagged.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <DoorCard
              shape="circle"
              badge="Public · No login"
              title="Samples"
              description="Small, watermark-free clips from every modality, browsable by anyone evaluating our data quality before committing."
              bullets={[
                "Preview clips per campaign (EgoTask, EgoGrasp, Teleop, MOCAP)",
                "Sensor manifest + metadata schema, no NDA required",
                "Read-only — no bulk export",
              ]}
              footLabel="Browse samples"
              href="/samples"
            />
            <DoorCard
              shape="square"
              badge="Staff · Contributor login"
              title="Uploads"
              description="The internal door for the capture team — push raw episodes from the NAS, watch validation and anonymization run, fix what fails."
              bullets={[
                "Ingestion status per episode: queued / validating / cataloged",
                "Auto-anonymization + QA rejection reasons, in one queue",
                "No customer-facing visibility",
              ]}
              footLabel="Contributor sign-in"
              href="/uploads"
            />
            <DoorCard
              shape="diamond"
              badge="Customer · Org entitlement"
              title="Datasets"
              description="Full, versioned datasets licensed to a specific org — pulled by API or signed URL, scoped to exactly what's in the contract."
              bullets={[
                "Entitlement-gated by organization, not by user",
                "Versioned releases, LeRobot-compatible export",
                "Usage + download activity logged per org",
              ]}
              footLabel="Request access"
              href="/datasets"
            />
          </div>
        </div>
      </section>

      <section id="modalities" className="py-20">
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="mb-11">
            <div className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
              Modality catalog
            </div>
            <h2 className="section-title mt-2 text-[1.7rem] sm:text-[2.35rem]">
              Six ways we capture how bodies move through the world.
            </h2>
          </div>
          <ModalityTable modalities={modalities} />
        </div>
      </section>

      <section id="pipeline" className="border-y border-line bg-paper-alt py-20">
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="mb-11">
            <div className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-soft">
              How a dataset gets made
            </div>
            <h2 className="section-title mt-2 text-[1.7rem] sm:text-[2.35rem]">
              From a NAS on our floor to a signed URL in yours.
            </h2>
          </div>

          <div className="mb-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.num}>
                <div className="mb-2.5 font-display text-[0.82rem] font-extrabold text-signal-ink">{s.num}</div>
                <h4 className="mb-2 font-display text-[1rem] font-extrabold">{s.title}</h4>
                <p className="text-[0.85rem] text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>

          <PipelineDiagram />
        </div>
      </section>

      <section id="labs" className="bracketed dark-band bg-line-strong py-24 text-paper">
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="font-mono text-[0.72rem] uppercase tracking-wider text-paper/60">
            For frontier labs
          </div>
          <h2 className="my-4 text-[1.8rem] text-paper sm:text-[2.6rem]">
            Tell us the modality, the volume,
            <br />
            and the region. We&apos;ll scope the campaign.
          </h2>
          <p className="mb-8 max-w-[62ch] text-paper/70">
            Pull from datasets already in the catalog, or commission a custom capture campaign with a
            defined scope, region, and sensor manifest. Either way, delivery is the same signed-URL
            pipeline.
          </p>
          <div className="flex flex-wrap gap-3">
            <PillButton href="/datasets" variant="inverted" icon="arrow">
              Request a Dataset
            </PillButton>
            <PillButton href="mailto:ravi@objectways.com" variant="ghost-inverted">
              Talk to Us
            </PillButton>
          </div>
        </div>
      </section>
    </>
  );
}
