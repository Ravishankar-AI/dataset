"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { setUserBlocked } from "@/lib/audit";

export async function blockUser(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) return;

  const userId = String(formData.get("userId") ?? "");
  const blocked = formData.get("blocked") === "true";
  // getSession() itself refuses a blocked user's session (see
  // src/lib/auth.ts) -- blocking your own account here would lock you
  // out of this exact page with no other way to reverse it.
  if (!userId || userId === session.userId) return;

  await setUserBlocked(userId, blocked);
  revalidatePath("/admin/activity");
}
