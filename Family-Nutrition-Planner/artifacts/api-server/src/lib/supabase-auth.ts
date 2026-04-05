import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  email_confirmed_at?: string | null;
}

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: SupabaseUser;
}

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  exp?: number;
  iss?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

function getSupabaseConfig() {
  return {
    url: requiredEnv("SUPABASE_URL").replace(/\/$/, ""),
    anonKey: requiredEnv("SUPABASE_ANON_KEY"),
    jwtSecret: requiredEnv("SUPABASE_JWT_SECRET"),
  };
}

async function supabaseAuthRequest(path: string, init: RequestInit = {}, bearerToken?: string) {
  const { url, anonKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("Content-Type", "application/json");
  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  const response = await fetch(`${url}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function supabaseSignUp(email: string, password: string, meta: Record<string, unknown>) {
  const { response, data } = await supabaseAuthRequest("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: meta }),
  });

  if (!response.ok) {
    throw new Error((data as { msg?: string; error_description?: string }).error_description ?? (data as { msg?: string }).msg ?? "Unable to create account");
  }

  return data as { session?: SupabaseSession | null; user?: SupabaseUser | null };
}

export async function supabaseSignIn(email: string, password: string) {
  const { response, data } = await supabaseAuthRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error((data as { error_description?: string; msg?: string }).error_description ?? "Invalid email or password");
  }

  return data as SupabaseSession;
}

export async function supabaseSignOut(token: string): Promise<void> {
  await supabaseAuthRequest("/auth/v1/logout", { method: "POST" }, token);
}

function decodeSupabaseJwt(token: string): SupabaseJwtPayload | null {
  try {
    return jwt.verify(token, getSupabaseConfig().jwtSecret) as SupabaseJwtPayload;
  } catch {
    return null;
  }
}

export async function verifySupabaseAccessToken(token: string): Promise<SupabaseUser | null> {
  const decoded = decodeSupabaseJwt(token);
  if (!decoded?.sub) {
    return null;
  }

  const { url } = getSupabaseConfig();
  if (decoded.iss && !decoded.iss.startsWith(`${url}/auth/v1`)) {
    return null;
  }

  const { response, data } = await supabaseAuthRequest("/auth/v1/user", { method: "GET" }, token);
  if (!response.ok) {
    return null;
  }

  const user = data as SupabaseUser;
  if (user.id !== decoded.sub) {
    return null;
  }

  return user;
}

function inferDisplayName(user: SupabaseUser): string {
  const fromMeta = user.user_metadata?.name;
  if (typeof fromMeta === "string" && fromMeta.trim().length > 0) {
    return fromMeta.trim().slice(0, 100);
  }
  const emailPrefix = user.email?.split("@")[0]?.trim();
  return emailPrefix && emailPrefix.length > 0 ? emailPrefix.slice(0, 100) : "User";
}

function inferPrimaryLanguage(user: SupabaseUser): string {
  const candidate = user.user_metadata?.primaryLanguage;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim().toLowerCase();
  }
  return "hindi";
}

export async function findOrCreateLocalUserFromSupabase(user: SupabaseUser) {
  const authUserId = user.id;
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Supabase user email is missing");
  }

  const [existingByAuthId] = await db.select().from(usersTable).where(eq(usersTable.authUserId, authUserId));

  if (existingByAuthId) {
    if (existingByAuthId.email !== email) {
      const [updated] = await db.update(usersTable).set({ email, updatedAt: new Date() }).where(eq(usersTable.id, existingByAuthId.id)).returning();
      return updated;
    }
    return existingByAuthId;
  }

  const [existingByEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (existingByEmail) {
    const [linked] = await db.update(usersTable).set({ authUserId, updatedAt: new Date() }).where(eq(usersTable.id, existingByEmail.id)).returning();
    return linked;
  }

  const [created] = await db.insert(usersTable).values({
    email,
    name: inferDisplayName(user),
    primaryLanguage: inferPrimaryLanguage(user),
    isVerified: !!user.email_confirmed_at,
    authUserId,
    passwordHash: null,
  }).returning();

  return created;
}
