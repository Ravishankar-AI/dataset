export default async function PlaceholderDownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; key?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-[640px] px-8 py-24 text-center">
      <div className="mb-4 font-mono text-[0.72rem] uppercase tracking-wider text-signal-ink">
        No live R2 credentials in this environment
      </div>
      <h1 className="mb-4 text-[1.8rem]">This would be a signed R2 download.</h1>
      <p className="mb-6 text-ink-soft">
        In production this button calls <code className="text-signal-ink">getSignedDownloadUrl()</code> in{" "}
        <code className="text-signal-ink">src/lib/r2.ts</code> and redirects straight to Cloudflare R2 — the
        app server never proxies the file bytes. Set <code>R2_ACCOUNT_ID</code>,{" "}
        <code>R2_ACCESS_KEY_ID</code>, and <code>R2_SECRET_ACCESS_KEY</code> to see a real signed URL.
      </p>
      <div className="rounded border border-dashed border-line bg-paper-alt p-4 text-left font-mono text-[0.78rem] text-ink-soft">
        <div>bucket: {params.bucket ?? "—"}</div>
        <div>key: {params.key ?? "—"}</div>
      </div>
    </div>
  );
}
