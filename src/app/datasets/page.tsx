import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listPurchasableDatasets, listPurchaseRequests } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { formatBytes, formatRelativeTime } from "@/lib/format";

export const metadata = { title: "Datasets — Objectways Data" };

const REQUEST_STATUS_STYLE: Record<string, string> = {
  pending: "text-signal-ink border-signal-ink",
  approved: "text-ink border-ink",
  declined: "text-ink-faint border-ink-faint line-through",
};

export default async function DatasetsPage({
  searchParams,
}: {
  searchParams: Promise<{ requested?: string }>;
}) {
  const { requested } = await searchParams;
  const session = await requireRole("customer", "admin");
  if (!session) redirect("/sign-in?next=/datasets");

  const isAdmin = session.role === "admin";
  const [datasets, purchaseRequests] = await Promise.all([
    isAdmin
      ? prisma.dataset.findMany({
          where: { accessTier: "customer", status: "published" },
          include: { modality: true, entitlements: { include: { organization: true } } },
        })
      : listPurchasableDatasets(session.organizationId),
    isAdmin ? listPurchaseRequests() : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-[1180px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        {isAdmin ? "Admin · All customer datasets" : `${session.organizationName} · Datasets`}
      </div>
      <h1 className="mb-4 text-[2rem] sm:text-[2.6rem]">Datasets</h1>
      <p className="mb-10 max-w-[62ch] text-ink-soft">
        Full, versioned datasets. Anything your organization already holds a license for is ready to
        download; everything else can be requested for purchase.
      </p>

      {requested && (
        <div className="mb-8 border border-signal-ink bg-signal-soft px-5 py-4 text-[0.85rem] text-signal-ink">
          Purchase request sent — we&apos;ll follow up by email to arrange access.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {datasets.map((d) => {
          const entitled = isAdmin
            ? true
            : (d as Awaited<ReturnType<typeof listPurchasableDatasets>>[number]).entitled;
          return (
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
                {entitled ? (
                  <span className="text-[0.72rem] uppercase tracking-wider text-signal-ink">View →</span>
                ) : (
                  <span className="text-[0.72rem] uppercase tracking-wider text-ink-faint">
                    {d.priceLabel ?? "Request pricing"} · View →
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {datasets.length === 0 && (
        <p className="text-ink-faint">No customer-tier datasets published yet.</p>
      )}

      {purchaseRequests && (
        <div className="mt-16">
          <h2 className="mb-1.5 font-display text-[1.15rem] font-extrabold">Purchase requests</h2>
          <p className="mb-5 text-[0.85rem] text-ink-soft">Every purchase request, newest first.</p>

          {purchaseRequests.length === 0 ? (
            <p className="text-ink-faint">No purchase requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    {["Organization", "Dataset", "Requested by", "Submitted", "Status"].map((h) => (
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
                  {purchaseRequests.map((r, i) => (
                    <tr key={r.id}>
                      <td
                        className={`py-4 pr-4 text-[0.85rem] ${i === purchaseRequests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        {r.organization.name}
                      </td>
                      <td
                        className={`py-4 pr-4 text-[0.85rem] ${i === purchaseRequests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        {r.dataset.title}
                      </td>
                      <td
                        className={`py-4 pr-4 text-[0.8rem] text-ink-soft ${i === purchaseRequests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        <div>{r.requestedByName}</div>
                        <div className="text-[0.75rem] text-ink-faint">{r.requestedByEmail}</div>
                      </td>
                      <td
                        className={`py-4 pr-4 font-mono text-[0.78rem] text-ink-faint ${i === purchaseRequests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}
                      >
                        {formatRelativeTime(r.createdAt)}
                      </td>
                      <td className={`py-4 ${i === purchaseRequests.length - 1 ? "border-b border-line" : "border-b border-dashed border-line"}`}>
                        <span
                          className={`inline-block rounded-pill border px-3 py-1 font-mono text-[0.66rem] uppercase tracking-wider ${REQUEST_STATUS_STYLE[r.status]}`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
