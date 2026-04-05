import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { findOrCreateLocalUserFromSupabase, verifySupabaseAccessToken } from "../lib/supabase-auth.js";

export interface AuthPayload {
  userId: number;
  email: string;
  authUserId?: string;
  source: "supabase" | "legacy_jwt";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
}

function shouldAllowLegacyJwt(): boolean {
  return process.env.AUTH_LEGACY_JWT_COMPAT === "true";
}

async function decodeSupabaseUser(token: string): Promise<AuthPayload | null> {
  const supabaseUser = await verifySupabaseAccessToken(token);
  if (!supabaseUser) {
    return null;
  }

  const localUser = await findOrCreateLocalUserFromSupabase(supabaseUser);
  return {
    userId: localUser.id,
    email: localUser.email,
    authUserId: supabaseUser.id,
    source: "supabase",
  };
}

function decodeLegacyJwt(token: string): AuthPayload | null {
  if (!shouldAllowLegacyJwt()) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId?: number; email?: string };
    if (typeof payload.userId !== "number" || typeof payload.email !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      source: "legacy_jwt",
    };
  } catch {
    return null;
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication token required" });
    return;
  }

  const supabasePayload = await decodeSupabaseUser(token);
  if (supabasePayload) {
    req.user = supabasePayload;
    next();
    return;
  }

  const legacyPayload = decodeLegacyJwt(token);
  if (legacyPayload) {
    req.user = legacyPayload;
    next();
    return;
  }

  res.status(401).json({ error: "Invalid or expired token" });
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = getBearerToken(req);

  if (token) {
    const supabasePayload = await decodeSupabaseUser(token);
    if (supabasePayload) {
      req.user = supabasePayload;
      next();
      return;
    }

    const legacyPayload = decodeLegacyJwt(token);
    if (legacyPayload) {
      req.user = legacyPayload;
    }
  }

  next();
}
