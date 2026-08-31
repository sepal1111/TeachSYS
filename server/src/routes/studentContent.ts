// Student-facing course materials browsing — read-only, JWT-guarded (requireStudentAuth).
// Mirrors src/routes/units.ts (the teacher-side CRUD) but only ever returns
// visible (is_hidden=0) content, scoped strictly to the token's own course_id.
import { Router } from "express";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { requireStudentAuth } from "../middleware/studentAuth";
import { getNowStrTaipei } from "../timezone";

export const studentContentRouter = autoCatch(Router());
studentContentRouter.use(requireStudentAuth);

studentContentRouter.get("/units", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;

  const units = await prisma.unit.findMany({
    where: { courseId, isHidden: 0 },
    orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
    include: {
      subUnits: {
        where: { isHidden: 0 },
        orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
        include: {
          materials: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
          readingProgress: { where: { studentId } },
        },
      },
    },
  });

  res.json(
    units.map((u) => ({
      id: u.id,
      title: u.title,
      sub_units: u.subUnits.map((su) => ({
        id: su.id,
        title: su.title,
        category: su.category,
        description: su.description,
        materials: su.materials,
        viewed: su.readingProgress.length > 0,
        view_count: su.readingProgress[0]?.viewCount ?? 0,
        last_viewed_at: su.readingProgress[0]?.lastViewedAt ?? null,
      })),
    }))
  );
});

studentContentRouter.post("/subunits/:subUnitId/view", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const subUnitId = Number(req.params.subUnitId);

  const subUnit = await prisma.subUnit.findFirst({ where: { id: subUnitId, unit: { courseId } } });
  if (!subUnit) {
    res.status(404).json({ detail: "Sub-unit not found" });
    return;
  }

  const now = getNowStrTaipei();
  const existing = await prisma.readingProgress.findUnique({
    where: { subUnitId_studentId: { subUnitId, studentId } },
  });

  if (existing) {
    await prisma.readingProgress.update({
      where: { id: existing.id },
      data: { lastViewedAt: now, viewCount: existing.viewCount + 1 },
    });
  } else {
    await prisma.readingProgress.create({
      data: { subUnitId, studentId, firstViewedAt: now, lastViewedAt: now, viewCount: 1 },
    });
  }

  res.json({ message: "已記錄閱讀進度" });
});
