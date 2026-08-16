"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createIntakeRequest } from "@/lib/catalog";

export async function submitIntakeRequest(formData: FormData) {
  const session = await getSession();

  const kind = String(formData.get("kind") ?? "");
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const transferNotes = String(formData.get("transferNotes") ?? "").trim();

  if (!["sell_data", "request_evaluation"].includes(kind) || !contactName || !contactEmail || !description) {
    redirect("/uploads?error=missing");
  }

  await createIntakeRequest({
    kind,
    contactName,
    contactEmail,
    organizationName: organizationName || session?.organizationName || undefined,
    description,
    transferNotes: transferNotes || undefined,
  });

  redirect("/uploads?submitted=1");
}
