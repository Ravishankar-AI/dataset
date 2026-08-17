import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_2FA_COOKIE } from "@/lib/auth";
import { verifyCode, resendCode } from "./actions";

export const metadata = { title: "Verify sign-in — Objectways Data" };

const ERROR_COPY: Record<string, string> = {
  invalid: "That code isn't right. Try again.",
  expired: "That code expired. Request a new one below.",
  too_many_attempts: "Too many attempts. Request a new code below.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; sent?: string }>;
}) {
  const [store, resolvedSearchParams] = await Promise.all([cookies(), searchParams]);
  const next = resolvedSearchParams.next ?? "/samples";

  if (!store.get(PENDING_2FA_COOKIE)?.value) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const errorMessage = resolvedSearchParams.error ? ERROR_COPY[resolvedSearchParams.error] : null;

  return (
    <div className="mx-auto max-w-[480px] px-8 py-16">
      <h1 className="mb-4 text-[2rem]">Check your email</h1>
      <p className="mb-8 max-w-[62ch] text-ink-soft">
        We sent a 6-digit code to your email address. Enter it below to finish signing in.
      </p>

      {errorMessage && (
        <p className="mb-6 border border-line-strong bg-paper-alt p-3 text-[0.85rem] text-signal-ink">
          {errorMessage}
        </p>
      )}
      {resolvedSearchParams.sent === "1" && !errorMessage && (
        <p className="mb-6 border border-line bg-paper-alt p-3 text-[0.85rem] text-ink-soft">
          A new code has been sent.
        </p>
      )}

      <form action={verifyCode} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">Code</span>
          <input
            type="text"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            className="border border-line bg-card px-4 py-3 text-center font-mono text-[1.4rem] tracking-[0.5em] outline-none focus:border-line-strong"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-pill border border-line-strong bg-signal px-5 py-3 font-mono text-[0.78rem] uppercase tracking-wider text-on-signal shadow-brand transition-shadow hover:shadow-none"
        >
          Verify
        </button>
      </form>

      <form action={resendCode} className="mt-4 text-center">
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint underline hover:text-ink"
        >
          Resend code
        </button>
      </form>
    </div>
  );
}
