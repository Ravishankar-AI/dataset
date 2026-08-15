import { cookies } from "next/headers";
import { prisma } from "./db";

/**
 * Mock auth for the design/dev phase.
 *
 * This exists so the three access tiers (Samples / Uploads / Datasets) can
 * be exercised end-to-end without a real identity provider wired up yet.
 * It stores a plaintext email in a cookie and trusts it — that is only
 * acceptable because there is no real user data behind it in this scaffold.
 *
 * To replace with real auth: swap `getSession()`'s cookie read for Clerk's
 * session lookup, or a self-hosted option like Auth.js (NextAuth) using the
 * Prisma adapter against this same Railway Postgres database. Keep the same
 * `Session` shape, and delete sign-in/route.ts.
 */

export const SESSION_COOKIE = "objectways_mock_session";

export type Role = "admin" | "contributor" | "customer";

export type Session = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string | null;
  organizationName: string | null;
};

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const email = store.get(SESSION_COOKIE)?.value;
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
  if (!user) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    organizationId: user.organizationId,
    organizationName: user.organization?.name ?? null,
  };
}

export async function requireRole(...roles: Role[]) {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) {
    return null;
  }
  return session;
}
