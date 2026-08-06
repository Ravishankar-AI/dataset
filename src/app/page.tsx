import { redirect } from "next/navigation";
import { PillButton } from "@/components/pill-button";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/samples");

  return (
    <div className="mx-auto max-w-[480px] px-8 py-24 text-center">
      <div className="mb-3 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">
        Objectways Data
      </div>
      <h1 className="mb-4 text-[2.1rem] leading-[1.1]">Robot training data, cataloged.</h1>
      <p className="mb-10 text-ink-soft">
        Sign in to your account, or register to start browsing sample datasets.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PillButton href="/sign-in">Sign in</PillButton>
        <PillButton href="/register" variant="ghost">
          Register
        </PillButton>
      </div>
    </div>
  );
}
