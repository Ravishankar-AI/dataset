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

// Every published customer-tier dataset, each flagged with whether this org
// already holds an Entitlement -- powers /datasets showing both "yours" and
// "available to purchase" datasets in one list.
export async function listPurchasableDatasets(organizationId: string) {
  const datasets = await prisma.dataset.findMany({
    where: { accessTier: "customer", status: "published" },
    include: { modality: true, entitlements: { where: { organizationId } } },
    orderBy: { updatedAt: "desc" },
  });
  return datasets.map((d) => ({ ...d, entitled: d.entitlements.length > 0 }));
}

export async function createPurchaseRequest(data: {
  datasetId: string;
  organizationId: string;
  requestedByName: string;
  requestedByEmail: string;
}) {
  return prisma.purchaseRequest.create({ data });
}

export async function listPurchaseRequests() {
  return prisma.purchaseRequest.findMany({
    include: { dataset: true, organization: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createIntakeRequest(data: {
  kind: string;
  contactName: string;
  contactEmail: string;
  organizationName?: string;
  description: string;
  transferNotes?: string;
}) {
  return prisma.intakeRequest.create({ data });
}

export async function listIntakeRequests() {
  return prisma.intakeRequest.findMany({ orderBy: { createdAt: "desc" } });
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

export async function listTasksForDataset(datasetId: string) {
  return prisma.task.findMany({
    where: { datasetId },
    orderBy: { taskIndex: "asc" },
    include: { _count: { select: { episodes: true } } },
  });
}

export async function getTaskForDataset(datasetId: string, taskId: string) {
  return prisma.task.findFirst({ where: { id: taskId, datasetId } });
}

export async function listEpisodesForTask(taskId: string) {
  return prisma.episode.findMany({
    where: { taskId },
    orderBy: { episodeIndex: "asc" },
  });
}

export async function getEpisodeForTask(taskId: string, episodeId: string) {
  return prisma.episode.findFirst({
    where: { id: episodeId, taskId },
    include: { task: true },
  });
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
