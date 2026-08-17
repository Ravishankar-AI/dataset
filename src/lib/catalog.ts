import { Prisma } from "@prisma/client";
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
// "available to purchase" datasets in one list. organizationId is nullable
// because self-registered customers (see src/app/register/actions.ts) don't
// get one -- Prisma rejects filtering a required FK column on a literal
// null, so a value that can never match a real cuid stands in for "no org".
export async function listPurchasableDatasets(organizationId: string | null) {
  const datasets = await prisma.dataset.findMany({
    where: { accessTier: "customer", status: "published" },
    include: { modality: true, entitlements: { where: { organizationId: organizationId ?? "__no_org__" } } },
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

export type TaskFilters = {
  search?: string;
  cameraCounts?: number[];
  page?: number;
  pageSize?: number;
};

// Filterable, paginated task list for a dataset -- powers the /samples/[slug]
// browse page (tasks first; episodes live one level down at
// /samples/[slug]/tasks/[taskId]). Includes each task's first sample episode
// so the task card can show a real thumbnail alongside the episode count.
export async function listFilteredTasksForDataset(datasetId: string, filters: TaskFilters = {}) {
  const { search, cameraCounts, page = 1, pageSize = 24 } = filters;

  const where: Prisma.TaskWhereInput = { datasetId };
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (cameraCounts && cameraCounts.length > 0) where.cameraCount = { in: cameraCounts };

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { taskIndex: "asc" },
      include: {
        _count: { select: { episodes: true } },
        episodes: { where: { episodeIndex: 0 }, take: 1 },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { tasks, total, page, pageSize };
}

// Real task titles for a dataset, deduplicated -- powers the task-name
// filter's <datalist> autocomplete on /samples/[slug] rather than leaving
// it a blind free-text field.
export async function listDistinctTaskTitles(datasetId: string) {
  const tasks = await prisma.task.findMany({
    where: { datasetId },
    select: { title: true },
    distinct: ["title"],
    orderBy: { title: "asc" },
  });
  return tasks.map((t) => t.title);
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

// Real task counts per camera-count bucket, for the filter checkboxes'
// "x123" counts -- always over the whole dataset, not the current
// filtered/paginated view.
export async function getTaskCameraCountBreakdown(datasetId: string) {
  const rows = await prisma.task.groupBy({
    by: ["cameraCount"],
    where: { datasetId },
    _count: true,
  });
  return rows
    .map((r) => ({ cameraCount: r.cameraCount, count: r._count }))
    .sort((a, b) => a.cameraCount - b.cameraCount);
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
