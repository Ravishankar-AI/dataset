import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listCustomerDatasets } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { formatBytes } from "@/lib/format";

export const metadata = { title: "Datasets — Objectways Data" };

export default async function DatasetsPage() {
  const session = await requireRole("customer", "admin");
  if (!session) redirect("/sign-in?next=/datasets");

  const datasets =
    session.role === "admin"
      ? await prisma.dataset.findMany({
          where: { accessTier: "customer", status: "published" },
          include: { modality: true, entitlements: { include: { organization: true } } },
        })
      : await listCustomerDatasets(session.organizationId!);

  return (
    <div className="mx-auto max-w-[1180px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        {session.role === "admin" ? "Admin · All customer datasets" : `${session.organizationName} · Entitled datasets`}
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.6rem]">Datasets</h1>
      <p className="mb-10 max-w-[62ch] text-ink-soft">
        Full, versioned datasets licensed to your organization. Entitlement is checked per org, not per
        user — anyone on your team signed in can pull what your contract covers.
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {datasets.map((d) => (
          <Link
            key={d.id}
            href={`/datasets/${d.slug}`}
            className="flex flex-col gap-3 border border-line bg-card p-6 hover:border-signal-ink"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] uppercase tracking-wider text-signal-ink">{d.modality.name}</span>
              <span className="text-[0.68rem] uppercase tracking-wider text-ink-faint">{d.version}</span>
            </div>
            <h3 className="font-display text-[1.15rem] font-extrabold">{d.title}</h3>
            <p className="text-[0.85rem] text-ink-soft">{d.description}</p>
            <div className="mt-1 flex items-center justify-between border-t border-dashed border-line pt-3.5">
              <span className="font-mono text-[0.72rem] tabular-nums text-ink-faint">{formatBytes(d.sizeBytes)}</span>
              <span className="text-[0.72rem] uppercase tracking-wider text-signal-ink">View →</span>
            </div>
          </Link>
        ))}
      </div>

      {datasets.length === 0 && (
        <p className="text-ink-faint">
          No datasets entitled to your organization yet. Reach out to request a campaign.
        </p>
      )}
    </div>
  );
}
