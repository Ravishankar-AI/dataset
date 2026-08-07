export default async function PlaceholderDownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; key?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-[640px] px-8 py-24 text-center">
      <div className="mb-4 font-mono text-[0.72rem] uppercase tracking-wider text-signal-ink">
        No live object storage credentials in this environment
      </div>
      <h1 className="mb-4 text-[1.8rem]">This would be a signed download.</h1>
      <p className="mb-6 text-ink-soft">
        In production this button calls <code className="text-signal-ink">getSignedDownloadUrl()</code> in{" "}
        <code className="text-signal-ink">src/lib/storage.ts</code> and redirects straight to the storage
        server — the app server never proxies the file bytes. Set <code>OBJECT_STORAGE_ENDPOINT</code>,{" "}
        <code>OBJECT_STORAGE_ACCESS_KEY_ID</code>, and <code>OBJECT_STORAGE_SECRET_ACCESS_KEY</code> to see a
        real signed URL.
      </p>
      <div className="rounded border border-dashed border-line bg-paper-alt p-4 text-left font-mono text-[0.78rem] text-ink-soft">
        <div>bucket: {params.bucket ?? "—"}</div>
        <div>key: {params.key ?? "—"}</div>
      </div>
    </div>
  );
}
