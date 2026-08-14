import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line py-12">
      <div className="mx-auto max-w-[1180px] px-8">
        <div className="flex flex-wrap justify-between gap-8">
          <Link href="/" className="flex items-baseline gap-[7px] font-display text-[1.05rem] font-extrabold">
            <span className="inline-block h-[9px] w-[9px] rotate-45 rounded-sm bg-signal" />
            OBJECTWAYS
            <span className="ml-0.5 border-l border-line pl-2 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
              Data
            </span>
          </Link>

          <div className="flex flex-wrap gap-14">
            <div>
              <h5 className="mb-3.5 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
                Catalog
              </h5>
              <div className="flex flex-col gap-2">
                <Link href="/samples" className="text-[0.82rem] text-ink-soft hover:text-ink">
                  Samples
                </Link>
                <Link href="/uploads" className="text-[0.82rem] text-ink-soft hover:text-ink">
                  Uploads
                </Link>
                <Link href="/datasets" className="text-[0.82rem] text-ink-soft hover:text-ink">
                  Datasets
                </Link>
              </div>
            </div>
            <div>
              <h5 className="mb-3.5 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
                Company
              </h5>
              <div className="flex flex-col gap-2">
                <Link href="/#labs" className="text-[0.82rem] text-ink-soft hover:text-ink">
                  For Labs
                </Link>
                <Link href="/sign-in" className="text-[0.82rem] text-ink-soft hover:text-ink">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-11 flex flex-wrap justify-between gap-3 border-t border-dashed border-line pt-5 text-[0.72rem] text-ink-faint">
          <span>© 2026 Objectways.</span>
          <span>Built on the NAS/MinIO → three-doors architecture.</span>
        </div>
      </div>
    </footer>
  );
}
