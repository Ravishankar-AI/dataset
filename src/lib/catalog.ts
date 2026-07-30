import { prisma } from "./db";
import type { Session } from "./auth";

/**
 * Query layer for the dataset registry. This is the "one catalog, three
 * doors" idea from the architecture: Samples, Uploads, and Datasets are
 * access-level filters over the same Dataset/Episode tables, not separate
 * databases.
 */

export async function listModalities() {
  return prisma.modality.findMany({
    orderBy: { name: "asc" },
  });
}

export async function listSampleDatasets() {
  return prisma.dataset.findMany({
    where: { accessTier: "sample", status: "published" },
    include: { modality: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listCustomerDatasets(organizationId: string) {
  return prisma.dataset.findMany({
    where: {
      accessTier: "customer",
      status: "published",
      entitlements: { some: { organizationId } },
    },
    include: { modality: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getDatasetForViewer(slug: string, session: Session | null) {
  const dataset = await prisma.dataset.findUnique({
    where: { slug },
    include: { modality: true, entitlements: true },
  });
  if (!dataset) return { dataset: null, allowed: false as const };

  if (dataset.accessTier === "sample") {
    return { dataset, allowed: dataset.status === "published" };
  }

  // Customer-tier dataset: admins can see everything; customers need an
  // entitlement for their org; contributors have no customer-facing access.
  if (session?.role === "admin") {
    return { dataset, allowed: true as const };
  }
  if (session?.role === "customer" && session.organizationId) {
    const allowed = dataset.entitlements.some(
      (e) => e.organizationId === session.organizationId
    );
    return { dataset, allowed };
  }
  return { dataset, allowed: false as const };
}

export async function listIngestionQueue() {
  return prisma.episode.findMany({
    include: { dataset: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getIngestionStats() {
  const episodes = await prisma.episode.findMany({ select: { status: true } });
  const counts: Record<string, number> = { queued: 0, validating: 0, cataloged: 0, rejected: 0 };
  for (const e of episodes) {
    counts[e.status] = (counts[e.status] ?? 0) + 1;
  }
  return counts;
}
