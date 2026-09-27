import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY: user asked how to log in to check /admin/activity and didn't
// know which account is an admin on production. Lists admin-role users'
// emails only (no password hashes) so they know which account to sign in
// with. Remove after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, name: true, isBlocked: true, createdAt: true },
  });

  return NextResponse.json({ admins });
}
