import { cookies } from "next/headers";
import { prisma } from "./db";

/**
 * Cookie-based auth: register/sign-in verify a scrypt password hash
 * (src/lib/password.ts), then the cookie holds the user's email and every
 * request re-reads the user row rather than trusting a session token.
 *
 * To replace with a real identity provider: swap `getSession()`'s cookie
 * read for Clerk's session lookup, or a self-hosted option like Auth.js
 * (NextAuth) using the Prisma adapter against this same Railway Postgres,
 * and keep the same `Session` shape.
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
