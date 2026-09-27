"use server";

import { redirect } from "next/navigation";
import { resetPassword } from "@/lib/password-reset";

export async function submitNewPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) redirect("/forgot-password");

  if (password.length < 8) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=invalid`);
  }
  if (password !== confirmPassword) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=mismatch`);
  }

  const result = await resetPassword(token, password);
  if (result !== "ok") {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${result}`);
  }

  redirect("/sign-in?reset=1");
}
