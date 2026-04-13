import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { authenticateToken } from "../../middlewares/auth.js";
import { findOrCreateLocalUserFromSupabase, supabaseSignIn, supabaseSignOut, supabaseSignUp, verifySupabaseAccessToken } from "../../lib/supabase-auth.js";

const router: IRouter = Router();

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    primaryLanguage: user.primaryLanguage,
    createdAt: user.createdAt,
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, name, primaryLanguage } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    primaryLanguage?: string;
  };

  if (!email || !password || !name) {
    res.status(400).json({ error: "Email, password and name are required" });
    return;
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const data = await supabaseSignUp(trimmedEmail, password, {
    name: name.trim().slice(0, 100),
    primaryLanguage: (primaryLanguage ?? "hindi").toLowerCase(),
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unable to create account";
    res.status(400).json({ error: message });
    return null;
  });

  if (!data?.user || !data.session) {
    return;
  }

  const localUser = await findOrCreateLocalUserFromSupabase(data.user);
  res.status(201).json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      tokenType: data.session.token_type,
    },
    user: sanitizeUser(localUser),
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const data = await supabaseSignIn(email.trim().toLowerCase(), password).catch(() => null);

  if (!data?.user || !data.access_token || !data.refresh_token) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const localUser = await findOrCreateLocalUserFromSupabase(data.user);
  res.json({
    session: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      tokenType: data.token_type,
    },
    user: sanitizeUser(localUser),
  });
});

router.get("/auth/me", authenticateToken, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(sanitizeUser(user));
});

router.post("/auth/logout", authenticateToken, async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (token) {
    const supabaseUser = await verifySupabaseAccessToken(token);
    if (supabaseUser) {
      await supabaseSignOut(token).catch(() => {
        // Best effort; client-side session invalidation is authoritative.
      });
    }
  }

  res.json({ message: "Logged out successfully" });
});

export default router;
