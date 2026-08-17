"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PENDING_2FA_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { sendLoginCode, verifyLoginCode } from "@/lib/twofactor";

export async function verifyCode(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const next = String(formData.get("next") ?? "/samples");

  const store = await cookies();
  const userId = store.get(PENDING_2FA_COOKIE)?.value;
  if (!userId) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const result = await verifyLoginCode(userId, code);
  if (result !== "ok") {
    redirect(`/sign-in/verify?next=${encodeURIComponent(next)}&error=${result}`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}&error=invalid`);
  }

  store.delete(PENDING_2FA_COOKIE);
  store.set(SESSION_COOKIE, user.email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(next || "/samples");
}

export async function resendCode(formData: FormData) {
  const next = String(formData.get("next") ?? "/samples");

  const store = await cookies();
  const userId = store.get(PENDING_2FA_COOKIE)?.value;
  if (!userId) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}&error=invalid`);
  }

  await sendLoginCode(user.id, user.email);
  redirect(`/sign-in/verify?next=${encodeURIComponent(next)}&sent=1`);
}
