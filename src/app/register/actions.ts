"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PENDING_2FA_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { sendEmail } from "@/lib/email";
import { isFreeEmailDomain } from "@/lib/free-email-domains";
import { sendLoginCode } from "@/lib/twofactor";

const SALES_EMAIL = process.env.SALES_NOTIFICATION_EMAIL || "sales@objectways.com";

export async function register(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/samples");

  const params = new URLSearchParams({ next });

  if (!name || !email || password.length < 8) {
    params.set("error", "invalid");
    redirect(`/register?${params.toString()}`);
  }

  if (isFreeEmailDomain(email)) {
    params.set("error", "free_email");
    redirect(`/register?${params.toString()}`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    params.set("error", "taken");
    redirect(`/register?${params.toString()}`);
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: hashPassword(password), role: "customer" },
  });

  try {
    await sendEmail({
      to: SALES_EMAIL,
      replyTo: email,
      subject: `[Registration] New signup: ${name}`,
      text: [`Name: ${name}`, `Email: ${email}`, "Role: customer"].join("\n"),
    });
  } catch (e) {
    // Never block registration on the email step -- the User row is the
    // real record either way.
    console.error("[register] failed to send sales notification email:", e);
  }

  await sendLoginCode(user.id, user.email);

  const store = await cookies();
  store.set(PENDING_2FA_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  redirect(`/sign-in/verify?next=${encodeURIComponent(next)}`);
}
