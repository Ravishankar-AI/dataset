import Link from "next/link";
import { isResetTokenValid } from "@/lib/password-reset";
import { submitNewPassword } from "./actions";

export const metadata = { title: "Reset password — Objectways Data" };

const ERROR_COPY: Record<string, string> = {
  invalid: "Password must be at least 8 characters.",
  mismatch: "Passwords don't match.",
  expired: "This link has expired. Request a new one.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token ?? "";
  const errorMessage = resolvedSearchParams.error ? ERROR_COPY[resolvedSearchParams.error] : null;
  // "invalid" here covers both a missing/malformed token and one that the
  // token-mismatch/expired errors above didn't already explain -- checked
  // fresh on every render so a token consumed by a first submission shows
  // this instead of a stale form on the confirmation-error redirect back
  // to this same page.
  const tokenLooksUsable = token && (await isResetTokenValid(token));

  return (
    <div className="mx-auto max-w-[480px] px-8 py-16">
      <h1 className="mb-4 text-[2rem]">Reset password</h1>

      {!tokenLooksUsable ? (
        <>
          <p className="mb-6 border border-line-strong bg-paper-alt p-4 text-[0.85rem] text-signal-ink">
            This link is invalid or has expired.
          </p>
          <Link href="/forgot-password" className="text-signal-ink underline">
            Request a new reset link
          </Link>
        </>
      ) : (
        <>
          <p className="mb-8 max-w-[62ch] text-ink-soft">Choose a new password for your account.</p>

          {errorMessage && (
            <p className="mb-6 border border-line-strong bg-paper-alt p-3 text-[0.85rem] text-signal-ink">
              {errorMessage}
            </p>
          )}

          <form action={submitNewPassword} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
                New password (min 8 characters)
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                className="border border-line bg-card px-4 py-3 text-[0.9rem] outline-none focus:border-line-strong"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
                Confirm new password
              </span>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={8}
                className="border border-line bg-card px-4 py-3 text-[0.9rem] outline-none focus:border-line-strong"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-pill border border-line-strong bg-signal px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
            >
              Reset password
            </button>
          </form>
        </>
      )}
    </div>
  );
}
