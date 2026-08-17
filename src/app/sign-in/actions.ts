"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PENDING_2FA_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { sendLoginCode } from "@/lib/twofactor";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/samples");

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}&error=invalid`);
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

export async function signOut(formData: FormData) {
  const next = String(formData.get("next") ?? "/");
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect(next || "/");
}
