"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDatasetForViewer } from "@/lib/catalog";
import { getSignedDownloadUrl } from "@/lib/minio";

export async function requestDownload(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const session = await getSession();

  // Re-check entitlement here too — a page-level gate isn't enough since
  // server actions can be invoked directly.
  const { dataset, allowed } = await getDatasetForViewer(slug, session);
  if (!dataset || !allowed) {
    redirect(`/sign-in?next=/datasets/${slug}`);
  }

  const { url } = await getSignedDownloadUrl(`${dataset.objectPrefix}manifest.tar`);
  redirect(url);
}
