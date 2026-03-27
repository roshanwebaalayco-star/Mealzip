import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { familiesTable, familyMembersTable } from "@workspace/db";
import {
  CreateFamilyBody,
  UpdateFamilyBody,
  UpdateFamilyParams,
  DeleteFamilyParams,
  GetFamilyParams,
  AddFamilyMemberBody,
  AddFamilyMemberParams,
  UpdateFamilyMemberParams,
  UpdateFamilyMemberBody,
  DeleteFamilyMemberParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/families", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const families = await db
    .select()
    .from(familiesTable)
    .where(eq(familiesTable.userId, userId))
    .orderBy(familiesTable.createdAt);
  res.json(families);
});

router.post("/families", async (req, res): Promise<void> => {
  const parsed = CreateFamilyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [family] = await db
    .insert(familiesTable)
    .values({ ...parsed.data, userId: req.user!.userId })
    .returning();
  res.status(201).json(family);
});

router.get("/families/:id", async (req, res): Promise<void> => {
  const params = GetFamilyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [family] = await db
    .select()
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.id));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const members = await db
    .select()
    .from(familyMembersTable)
    .where(eq(familyMembersTable.familyId, params.data.id));
  res.json({ ...family, members });
});

router.put("/families/:id", async (req, res): Promise<void> => {
  const params = UpdateFamilyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFamilyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (existing.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const [family] = await db
    .update(familiesTable)
    .set(parsed.data)
    .where(eq(familiesTable.id, params.data.id))
    .returning();
  res.json(family);
});

router.delete("/families/:id", async (req, res): Promise<void> => {
  const params = DeleteFamilyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (existing.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  await db.delete(familiesTable).where(eq(familiesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/families/:familyId/members", async (req, res): Promise<void> => {
  const familyId = parseInt(req.params.familyId);
  if (isNaN(familyId)) {
    res.status(400).json({ error: "Invalid familyId" });
    return;
  }
  const [family] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const members = await db
    .select()
    .from(familyMembersTable)
    .where(eq(familyMembersTable.familyId, familyId))
    .orderBy(familyMembersTable.id);
  res.json(members);
});

router.post("/families/:familyId/members", async (req, res): Promise<void> => {
  const params = AddFamilyMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [family] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const parsed = AddFamilyMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [member] = await db
    .insert(familyMembersTable)
    .values({ ...parsed.data, familyId: params.data.familyId })
    .returning();
  res.status(201).json(member);
});

router.put("/families/:familyId/members/:memberId", async (req, res): Promise<void> => {
  const params = UpdateFamilyMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [family] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const parsed = UpdateFamilyMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [member] = await db
    .update(familyMembersTable)
    .set(parsed.data)
    .where(
      and(
        eq(familyMembersTable.id, params.data.memberId),
        eq(familyMembersTable.familyId, params.data.familyId),
      ),
    )
    .returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(member);
});

router.delete("/families/:familyId/members/:memberId", async (req, res): Promise<void> => {
  const params = DeleteFamilyMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [family] = await db
    .select({ userId: familiesTable.userId })
    .from(familiesTable)
    .where(eq(familiesTable.id, params.data.familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  if (family.userId !== req.user!.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const [member] = await db
    .delete(familyMembersTable)
    .where(
      and(
        eq(familyMembersTable.id, params.data.memberId),
        eq(familyMembersTable.familyId, params.data.familyId),
      ),
    )
    .returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
