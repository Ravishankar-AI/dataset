import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { signInAs, signOut } from "./actions";

export const metadata = { title: "Sign in — Objectways Data" };

const ROLE_NOTE: Record<string, string> = {
  admin: "Sees everything across all three doors.",
  contributor: "Staff access to the Uploads ingestion queue.",
  customer: "Org-scoped access to entitled Datasets.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, users, resolvedSearchParams] = await Promise.all([
    getSession(),
    prisma.user.findMany({ include: { organization: true }, orderBy: { role: "asc" } }),
    searchParams,
  ]);
  const next = resolvedSearchParams.next ?? "/";

  return (
    <div className="mx-auto max-w-[640px] px-8 py-16">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        Mock auth — dev only
      </div>
      <h1 className="mb-4 text-[2rem]">Sign in</h1>
      <p className="mb-10 max-w-[62ch] text-ink-soft">
        There&apos;s no real identity provider wired up yet (see <code>src/lib/auth.ts</code>). Pick a
        seeded persona to see how each role&apos;s door renders.
      </p>

      {session && (
        <div className="mb-8 flex items-center justify-between border border-line bg-paper-alt p-4">
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
      )}

      <div className="flex flex-col gap-4">
        {users.map((u) => (
          <form
            key={u.id}
            action={signInAs}
            className="flex items-center justify-between gap-4 border border-line bg-card p-5"
          >
            <input type="hidden" name="email" value={u.email} />
            <input type="hidden" name="next" value={next} />
            <div>
              <div className="font-display text-[1rem] font-extrabold">
                {u.name}{" "}
                <span className="ml-2 font-mono text-[0.68rem] font-normal uppercase tracking-wider text-signal-ink">
                  {u.role}
                </span>
                {u.organization && (
                  <span className="ml-2 font-mono text-[0.68rem] font-normal uppercase tracking-wider text-ink-faint">
                    · {u.organization.name}
                  </span>
                )}
              </div>
              <p className="text-[0.8rem] text-ink-soft">{ROLE_NOTE[u.role]}</p>
            </div>
            <button
              type="submit"
              className="rounded-pill border border-line-strong bg-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-paper hover:opacity-90"
            >
              Sign in
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
