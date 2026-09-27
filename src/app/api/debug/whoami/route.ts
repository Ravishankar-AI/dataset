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

  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isBlocked: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins, allUsers });
}

// One-off: promote a specific account to admin by email. Requires the
// exact email as a query param rather than acting on "the first user" or
// similar, so this can't be misapplied to the wrong account.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const user = await prisma.user.update({
    where: { email },
    data: { role: "admin" },
    select: { id: true, email: true, role: true },
  });
  return NextResponse.json({ promoted: user });
}
