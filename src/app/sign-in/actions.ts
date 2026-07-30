"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";

export async function signInAs(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const next = String(formData.get("next") ?? "/");

  const store = await cookies();
  store.set(SESSION_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(next || "/");
}

export async function signOut(formData: FormData) {
  const next = String(formData.get("next") ?? "/");
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect(next || "/");
}
