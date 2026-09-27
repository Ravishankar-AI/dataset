import { randomBytes, createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { hashPassword } from "./password";

/**
 * Email-delivered "forgot password" link. Mirrors src/lib/twofactor.ts's
 * shape (hash-in-DB, expiring, single-use) but with a long random token
 * instead of a 6-digit code, since this isn't something the user types in
 * -- they click a link.
 */

const TOKEN_TTL_MINUTES = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function baseUrl() {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host");
  const proto = store.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Always looks like it worked from the caller's side, whether or not the
// email belongs to an account -- see the doc comment on requestPasswordReset
// for why, and the sign-in page for the same non-enumeration pattern.
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`[password-reset] no account for ${email}, not sending anything`);
    return;
  }

  const token = randomBytes(32).toString("hex");
  // Invalidate any still-pending reset for this user, same reasoning as
  // issueLoginCode: only the most recently requested link should work.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, consumedAt: null } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
    },
  });

  const link = `${await baseUrl()}/reset-password?token=${token}`;
  const { sent } = await sendEmail({
    to: user.email,
    subject: "Reset your Objectways password",
    text: `Someone requested a password reset for this account.\n\nReset your password: ${link}\n\nThis link expires in ${TOKEN_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email -- your password hasn't changed.`,
  });
  if (!sent) {
    // No live RESEND_API_KEY (local dev) -- print the link so the flow is
    // still testable without real email infrastructure.
    console.log(`[password-reset] email not sent -- reset link for ${email}: ${link}`);
  }
}

export type ResetTokenCheck = { userId: string } | { error: "invalid" | "expired" };

async function checkToken(token: string): Promise<ResetTokenCheck> {
  const pending = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashToken(token), consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) return { error: "invalid" };
  if (pending.expiresAt < new Date()) return { error: "expired" };
  return { userId: pending.userId };
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  const result = await checkToken(token);
  return !("error" in result);
}

export type ResetPasswordResult = "ok" | "invalid" | "expired";

export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
  const result = await checkToken(token);
  if ("error" in result) return result.error;

  await prisma.$transaction([
    prisma.user.update({ where: { id: result.userId }, data: { passwordHash: hashPassword(newPassword) } }),
    // Consumes every outstanding token for this user, not just the one
    // used -- a second unused reset link (e.g. from an earlier "forgot
    // password" click) shouldn't still work after the password changes.
    prisma.passwordResetToken.updateMany({
      where: { userId: result.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ]);

  return "ok";
}
