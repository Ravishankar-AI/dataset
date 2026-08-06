import Link from "next/link";
import type { Session } from "@/lib/auth";
import { Logo } from "./logo";

const NAV_LINKS = [
  { href: "/samples", label: "Samples" },
  { href: "/uploads", label: "Uploads" },
  { href: "/datasets", label: "Datasets" },
];

export function SiteHeader({ session }: { session: Session | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-6 px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="border-l border-line pl-2.5 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
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
            <>
              <span className="hidden text-[0.72rem] uppercase tracking-wider text-ink-faint sm:inline">
                {session.name} · {session.role}
              </span>
              <Link
                href="/sign-in"
                className="rounded-pill border border-line-strong bg-signal px-3.5 py-2 font-mono text-[0.68rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
              >
                Account
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="text-[0.74rem] uppercase tracking-wider text-ink-soft hover:text-ink">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-pill border border-line-strong bg-signal px-3.5 py-2 font-mono text-[0.68rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
