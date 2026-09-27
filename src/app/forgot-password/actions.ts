"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/password-reset";

export async function forgotPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/samples");

  if (email) {
    // Best-effort: never let an email-sending hiccup block the response,
    // and never reveal whether it succeeded -- see requestPasswordReset's
    // doc comment on why this always looks the same either way.
    await requestPasswordReset(email).catch((e) => console.error("[forgot-password] failed:", e));
  }

  redirect(`/forgot-password?sent=1&next=${encodeURIComponent(next)}`);
}
