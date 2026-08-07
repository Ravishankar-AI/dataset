"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDatasetForViewer } from "@/lib/catalog";
import { getSignedDownloadUrl } from "@/lib/storage";

const DATASETS_BUCKET = process.env.OBJECT_STORAGE_BUCKET_DATASETS || "datasets";

export async function requestDownload(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const session = await getSession();

  // Re-check entitlement here too — a page-level gate isn't enough since
  // server actions can be invoked directly.
  const { dataset, allowed } = await getDatasetForViewer(slug, session);
  if (!dataset || !allowed) {
    redirect(`/sign-in?next=/datasets/${slug}`);
  }

  const { url } = await getSignedDownloadUrl(DATASETS_BUCKET, `${dataset.r2Prefix}manifest.tar`);
  redirect(url);
}
