import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { getJwtSecret, authenticateToken, type AuthPayload } from "../../middlewares/auth.js";

const router: IRouter = Router();

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = "7d";

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

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    name,
    primaryLanguage: primaryLanguage || "hindi",
  }).returning({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    primaryLanguage: usersTable.primaryLanguage,
    createdAt: usersTable.createdAt,
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email } satisfies AuthPayload,
    getJwtSecret(),
    { expiresIn: TOKEN_EXPIRY }
  );

  res.status(201).json({ token, user });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email } satisfies AuthPayload,
    getJwtSecret(),
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      primaryLanguage: user.primaryLanguage,
      createdAt: user.createdAt,
    },
  });
});

router.get("/auth/me", authenticateToken, async (req, res): Promise<void> => {
  const [user] = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    primaryLanguage: usersTable.primaryLanguage,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.post("/auth/logout", authenticateToken, (_req, res): void => {
  res.json({ message: "Logged out successfully" });
});

export default router;
