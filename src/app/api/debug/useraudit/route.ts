import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY: check whether any user matching a name/email substring has
// AccessEvent (signed-URL access) history. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const users = await prisma.user.findMany({
    where: { email: { contains: q, mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true, blockedAt: true, createdAt: true },
  });

  const results = [];
  for (const u of users) {
    const accessCount = await prisma.accessEvent.count({ where: { userId: u.id } });
    const loginCount = await prisma.loginEvent.count({ where: { userId: u.id } });
    const recentAccess = await prisma.accessEvent.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { datasetSlug: true, taskId: true, episodeIndex: true, cameraCount: true, ipAddress: true, createdAt: true },
    });
    const recentLogins = await prisma.loginEvent.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { ipAddress: true, userAgent: true, createdAt: true },
    });
    results.push({ user: u, accessCount, loginCount, recentAccess, recentLogins });
  }

  return NextResponse.json({ query: q, matchedUsers: users.length, results });
}
