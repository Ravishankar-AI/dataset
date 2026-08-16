"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createPurchaseRequest } from "@/lib/catalog";

export async function requestPurchase(formData: FormData) {
  const session = await getSession();
  const datasetId = String(formData.get("datasetId") ?? "");
  const next = String(formData.get("next") ?? "/datasets");

  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!session.organizationId || !datasetId) redirect(next);

  await createPurchaseRequest({
    datasetId,
    organizationId: session.organizationId,
    requestedByName: session.name,
    requestedByEmail: session.email,
  });

  redirect(`${next}${next.includes("?") ? "&" : "?"}requested=1`);
}
