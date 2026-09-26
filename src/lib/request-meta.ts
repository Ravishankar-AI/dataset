import { headers } from "next/headers";

// Next.js has no direct "client IP" API for a server action/component --
// Railway's edge sets x-forwarded-for like any reverse proxy, so that's
// what's read here. Takes the first (client-side) entry since the header
// can carry a chain of proxy hops.
export async function getRequestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const store = await headers();
  const forwardedFor = store.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const userAgent = store.get("user-agent");
  return { ipAddress, userAgent };
}
