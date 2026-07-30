import Link from "next/link";
import type { Session } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/samples", label: "Samples" },
  { href: "/uploads", label: "Uploads" },
  { href: "/datasets", label: "Datasets" },
  { href: "/#pipeline", label: "Pipeline" },
];

export function SiteHeader({ session }: { session: Session | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-6 px-8">
        <Link href="/" className="flex items-baseline gap-[7px] font-display text-[1.05rem] font-extrabold">
          <span className="inline-block h-[9px] w-[9px] rotate-45 rounded-sm bg-signal" />
          OBJECTWAYS
          <span className="ml-0.5 border-l border-line pl-2 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
            Data
          </span>
        </Link>

        <nav className="hidden gap-7 text-[0.74rem] uppercase tracking-wider text-ink-soft md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {session ? (
            <span className="hidden text-[0.72rem] uppercase tracking-wider text-ink-faint sm:inline">
              {session.name} · {session.role}
            </span>
          ) : null}
          <Link
            href={session ? "/sign-in" : "/sign-in"}
            className="rounded-pill border border-line-strong bg-line-strong px-3.5 py-2 font-mono text-[0.68rem] uppercase tracking-wider text-paper hover:opacity-90"
          >
            {session ? "Switch user" : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  );
}
