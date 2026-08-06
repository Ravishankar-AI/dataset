import Link from "next/link";
import { getSession } from "@/lib/auth";
import { signIn, signOut } from "./actions";

export const metadata = { title: "Sign in — Objectways Data" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [session, resolvedSearchParams] = await Promise.all([getSession(), searchParams]);
  const next = resolvedSearchParams.next ?? "/samples";
  const hasError = resolvedSearchParams.error === "invalid";

  if (session) {
    return (
      <div className="mx-auto max-w-[480px] px-8 py-16">
        <h1 className="mb-4 text-[2rem]">Sign in</h1>
        <div className="flex items-center justify-between border border-line bg-paper-alt p-4">
          <span className="text-[0.85rem]">
            Signed in as <b>{session.name}</b> ({session.role})
          </span>
          <form action={signOut}>
            <input type="hidden" name="next" value={next} />
            <button className="text-[0.72rem] uppercase tracking-wider text-signal-ink underline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] px-8 py-16">
      <h1 className="mb-4 text-[2rem]">Sign in</h1>
      <p className="mb-8 max-w-[62ch] text-ink-soft">
        Don&apos;t have an account?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-signal-ink underline">
          Register
        </Link>{" "}
        to get access to sample datasets.
      </p>

      {hasError && (
        <p className="mb-6 border border-line-strong bg-paper-alt p-3 text-[0.85rem] text-signal-ink">
          Invalid email or password.
        </p>
      )}

      <form action={signIn} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Email</span>
          <input
            type="email"
            name="email"
            required
            className="border border-line bg-card px-4 py-3 text-[0.9rem] outline-none focus:border-line-strong"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Password</span>
          <input
            type="password"
            name="password"
            required
            className="border border-line bg-card px-4 py-3 text-[0.9rem] outline-none focus:border-line-strong"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-pill border border-line-strong bg-line-strong px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-paper hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
