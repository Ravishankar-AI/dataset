"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    params.set("error", "taken");
    redirect(`/register?${params.toString()}`);
  }

  await prisma.user.create({
    data: { name, email, passwordHash: hashPassword(password), role: "customer" },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(next || "/samples");
}
