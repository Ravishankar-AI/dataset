import Link from "next/link";
import { register } from "./actions";

export const metadata = { title: "Register — Objectways Data" };

const ERROR_COPY: Record<string, string> = {
  invalid: "Name, email, and a password of at least 8 characters are required.",
  taken: "An account with that email already exists.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const next = resolvedSearchParams.next ?? "/samples";
  const errorMessage = resolvedSearchParams.error ? ERROR_COPY[resolvedSearchParams.error] : null;

  return (
    <div className="mx-auto max-w-[480px] px-8 py-16">
      <h1 className="mb-4 text-[2rem]">Register</h1>
      <p className="mb-8 max-w-[62ch] text-ink-soft">
        Create an account to browse sample datasets.{" "}
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-signal-ink underline">
          Already have one? Sign in.
        </Link>
      </p>

      {errorMessage && (
        <p className="mb-6 border border-line-strong bg-paper-alt p-3 text-[0.85rem] text-signal-ink">
          {errorMessage}
        </p>
      )}

      <form action={register} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Name</span>
          <input
            type="text"
            name="name"
            required
            className="border border-line bg-card px-4 py-3 text-[0.9rem] outline-none focus:border-line-strong"
          />
        </label>
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
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
            Password (min 8 characters)
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            className="border border-line bg-card px-4 py-3 text-[0.9rem] outline-none focus:border-line-strong"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-pill border border-line-strong bg-line-strong px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-paper hover:opacity-90"
        >
          Register
        </button>
      </form>
    </div>
  );
}
