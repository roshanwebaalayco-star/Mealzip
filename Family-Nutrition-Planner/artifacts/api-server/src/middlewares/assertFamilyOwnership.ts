import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { familiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function assertFamilyOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const raw =
    req.params.familyId ??
    (req.query.familyId as string | undefined) ??
    (req.body as Record<string, unknown>)?.familyId;

  const familyId = typeof raw === "number" ? raw : parseInt(String(raw), 10);

  if (!familyId || isNaN(familyId)) {
    next();
    return;
  }

  try {
    const [family] = await db
      .select({ userId: familiesTable.userId })
      .from(familiesTable)
      .where(eq(familiesTable.id, familyId));

    if (!family) {
      res.status(404).json({ error: "Family not found" });
      return;
    }

    if (family.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: "Ownership check failed" });
  }
}
