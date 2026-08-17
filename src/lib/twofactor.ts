import { randomInt, createHash } from "node:crypto";
import { prisma } from "./db";
import { sendEmail } from "./email";

/**
 * Email-delivered one-time codes required on every sign-in (and right after
 * registration), before a session cookie is issued. See LoginCode in
 * schema.prisma for the storage shape and src/lib/auth.ts's
 * PENDING_2FA_COOKIE for how a verified-password-but-not-yet-verified-code
 * user is tracked between the two steps.
 */

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Invalidates any still-pending code for this user before issuing a new one,
// so only the most recently sent code (e.g. after "Resend code") ever works.
async function issueLoginCode(userId: string): Promise<string> {
  const code = generateCode();
  await prisma.loginCode.deleteMany({ where: { userId, consumedAt: null } });
  await prisma.loginCode.create({
    data: {
      userId,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    },
  });
  return code;
}

export async function sendLoginCode(userId: string, email: string) {
  const code = await issueLoginCode(userId);
  const { sent } = await sendEmail({
    to: email,
    subject: "Your Objectways sign-in code",
    text: `Your sign-in code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.\n\nIf you didn't request this, you can ignore this email.`,
  });
  if (!sent) {
    // No live RESEND_API_KEY (local dev) -- print the code so the flow is
    // still testable without real email infrastructure.
    console.log(`[2fa] email not sent -- login code for ${email}: ${code}`);
  }
}

export type VerifyCodeResult = "ok" | "invalid" | "expired" | "too_many_attempts";

export async function verifyLoginCode(userId: string, code: string): Promise<VerifyCodeResult> {
  const pending = await prisma.loginCode.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) return "invalid";
  if (pending.attempts >= MAX_ATTEMPTS) return "too_many_attempts";
  if (pending.expiresAt < new Date()) return "expired";

  if (pending.codeHash !== hashCode(code.trim())) {
    await prisma.loginCode.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
    return "invalid";
  }

  await prisma.loginCode.update({ where: { id: pending.id }, data: { consumedAt: new Date() } });
  return "ok";
}
