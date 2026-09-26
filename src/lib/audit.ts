import { prisma } from "./db";

/**
 * Login + file-access audit trail for /admin/activity. See LoginEvent
 * and AccessEvent in prisma/schema.prisma for what each row means and
 * why access is "issued a signed link", not a confirmed download.
 */

export async function logLogin(userId: string, meta: { ipAddress: string | null; userAgent: string | null }) {
  await prisma.loginEvent.create({
    data: { userId, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
  });
}

export async function logAccess(params: {
  userId: string;
  datasetSlug: string;
  taskId: string;
  episodeIndex: number;
  cameraCount: number;
  ipAddress: string | null;
}) {
  await prisma.accessEvent.create({ data: params });
}

export async function listRecentLogins(limit = 100) {
  return prisma.loginEvent.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true, role: true } } },
  });
}

export async function listRecentAccess(limit = 100) {
  return prisma.accessEvent.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true, role: true } } },
  });
}

// Per-user rollup driving the "who's accessing a lot" view: total access
// events, how many landed in the last 24h, and how many distinct episodes
// that spans -- a handful of views is normal browsing, dozens of distinct
// episodes in a short window looks like scraping rather than someone
// reviewing samples.
export async function listUserActivitySummary() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      blockedAt: true,
      organization: { select: { name: true } },
      _count: { select: { accessEvents: true, loginEvents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const recentAccess = await prisma.accessEvent.findMany({
    where: { createdAt: { gte: since24h } },
    select: { userId: true, taskId: true, episodeIndex: true },
  });

  const recentByUser = new Map<string, { count: number; episodes: Set<string> }>();
  for (const e of recentAccess) {
    const entry = recentByUser.get(e.userId) ?? { count: 0, episodes: new Set<string>() };
    entry.count += 1;
    entry.episodes.add(`${e.taskId}:${e.episodeIndex}`);
    recentByUser.set(e.userId, entry);
  }

  const lastLoginByUser = new Map<string, Date>();
  const lastLogins = await prisma.loginEvent.findMany({
    distinct: ["userId"],
    orderBy: { createdAt: "desc" },
    select: { userId: true, createdAt: true },
  });
  for (const l of lastLogins) lastLoginByUser.set(l.userId, l.createdAt);

  return users.map((u) => {
    const recent = recentByUser.get(u.id);
    return {
      ...u,
      totalAccessEvents: u._count.accessEvents,
      totalLogins: u._count.loginEvents,
      accessLast24h: recent?.count ?? 0,
      distinctEpisodesLast24h: recent?.episodes.size ?? 0,
      lastLoginAt: lastLoginByUser.get(u.id) ?? null,
    };
  });
}

export async function setUserBlocked(userId: string, blocked: boolean) {
  await prisma.user.update({
    where: { id: userId },
    data: { isBlocked: blocked, blockedAt: blocked ? new Date() : null },
  });
}
