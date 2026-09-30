import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY: one-off dataset title renames requested by the user. Remove
// after use.
const DEBUG_SECRET = "zrcje5-thumb-audit-20260925";

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug");
  const title = req.nextUrl.searchParams.get("title");
  if (!slug || !title) return NextResponse.json({ error: "slug and title required" }, { status: 400 });

  const dataset = await prisma.dataset.update({ where: { slug }, data: { title } });
  return NextResponse.json({ slug: dataset.slug, title: dataset.title });
}
