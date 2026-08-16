import { Resend } from "resend";

/**
 * Transactional email via Resend. Mirrors lib/minio.ts's pattern for
 * optional live credentials: without RESEND_API_KEY configured, sends are
 * skipped (logged, not thrown) so the app -- and whatever triggered the
 * email, like an intake-request submission -- keeps working without live
 * infrastructure. The database row is always the source of truth; email is
 * best-effort notification on top of it.
 */

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Objectways Data <onboarding@resend.dev>";

function hasResendCredentials() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(params: { to: string; subject: string; text: string; replyTo?: string }) {
  if (!hasResendCredentials()) {
    console.log("[email] RESEND_API_KEY not configured, skipping send:", params.subject);
    return { sent: false as const };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    text: params.text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
  });

  if (error) {
    console.error("[email] Resend send failed:", error);
    return { sent: false as const };
  }
  return { sent: true as const };
}
