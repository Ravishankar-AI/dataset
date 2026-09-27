import Link from "next/link";
import { forgotPassword } from "./actions";

export const metadata = { title: "Forgot password — Objectways Data" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const next = resolvedSearchParams.next ?? "/samples";
  const sent = resolvedSearchParams.sent === "1";

  return (
    <div className="mx-auto max-w-[480px] px-8 py-16">
      <h1 className="mb-4 text-[2rem]">Forgot password</h1>

      {sent ? (
        <div className="border border-line-strong bg-paper-alt p-4 text-[0.85rem]">
          If an account exists for that email, we&apos;ve sent a link to reset the password. It expires
          in 30 minutes.
        </div>
      ) : (
        <>
          <p className="mb-8 max-w-[62ch] text-ink-soft">
            Enter the email on your account and we&apos;ll send a link to reset your password.
          </p>
          <form action={forgotPassword} className="flex flex-col gap-4">
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
            <button
              type="submit"
              className="mt-2 rounded-pill border border-line-strong bg-signal px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
            >
              Send reset link
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-[0.85rem] text-ink-soft">
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-signal-ink underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
