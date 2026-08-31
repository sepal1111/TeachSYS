// Teacher-side course materials & units management (Course -> Unit -> SubUnit -> Material).
// Mounted behind requireAuth (teacher system session) — see src/routes/studentContent.ts
// for the read-only, JWT-guarded student-facing counterpart.
import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { getUploadsDir } from "../paths";

export const unitsRouter = autoCatch(Router());
const upload = multer({ storage: multer.memoryStorage() });

async function fetchUnitsTree(courseId: number) {
  const units = await prisma.unit.findMany({
    where: { courseId },
    orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
    include: {
      subUnits: {
        orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
        include: { materials: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] } },
      },
    },
  });
  return units;
}

// --- Units ---

unitsRouter.get("/:courseId", async (req, res) => {
  res.json(await fetchUnitsTree(Number(req.params.courseId)));
});

unitsRouter.post("/:courseId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const title: string = (req.body?.title ?? "").trim();
  if (!title) {
    res.status(400).json({ detail: "請輸入單元標題" });
    return;
  }
  const maxOrder = await prisma.unit.aggregate({ where: { courseId }, _max: { orderIndex: true } });
  const unit = await prisma.unit.create({
    data: { courseId, title, orderIndex: (maxOrder._max.orderIndex ?? 0) + 1 },
  });
  res.json({ id: unit.id, message: "單元建立成功！" });
});

unitsRouter.put("/:courseId/reorder", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const unitIds: number[] = req.body?.unit_ids ?? [];
  for (let i = 0; i < unitIds.length; i++) {
    await prisma.unit.updateMany({ where: { id: unitIds[i], courseId }, data: { orderIndex: i } });
  }
  res.json({ message: "單元順序已更新" });
});

unitsRouter.put("/:courseId/:unitId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const unitId = Number(req.params.unitId);
  const data: Record<string, unknown> = {};
  if (typeof req.body?.title === "string") data.title = req.body.title.trim();
  if (typeof req.body?.is_hidden === "boolean") data.isHidden = req.body.is_hidden ? 1 : 0;
  if (typeof req.body?.order_index === "number") data.orderIndex = req.body.order_index;

  const result = await prisma.unit.updateMany({ where: { id: unitId, courseId }, data });
  if (result.count === 0) {
    res.status(404).json({ detail: "Unit not found" });
    return;
  }
  res.json({ message: "單元已更新" });
});

unitsRouter.delete("/:courseId/:unitId", async (req, res) => {
  await prisma.unit.deleteMany({ where: { id: Number(req.params.unitId), courseId: Number(req.params.courseId) } });
  res.json({ message: "單元已刪除" });
});

// --- Sub-units ---

unitsRouter.post("/:courseId/:unitId/subunits", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const unitId = Number(req.params.unitId);
  const unit = await prisma.unit.findFirst({ where: { id: unitId, courseId } });
  if (!unit) {
    res.status(404).json({ detail: "Unit not found" });
    return;
  }
  const title: string = (req.body?.title ?? "").trim();
  if (!title) {
    res.status(400).json({ detail: "請輸入小單元標題" });
    return;
  }
  const category: string = req.body?.category ?? "material";
  const description: string | null = req.body?.description ?? null;

  const maxOrder = await prisma.subUnit.aggregate({ where: { unitId }, _max: { orderIndex: true } });
  const subUnit = await prisma.subUnit.create({
    data: { unitId, title, category, description, orderIndex: (maxOrder._max.orderIndex ?? 0) + 1 },
  });
  res.json({ id: subUnit.id, message: "小單元建立成功！" });
});

unitsRouter.put("/:courseId/:unitId/subunits/reorder", async (req, res) => {
  const unitId = Number(req.params.unitId);
  const subUnitIds: number[] = req.body?.sub_unit_ids ?? [];
  for (let i = 0; i < subUnitIds.length; i++) {
    await prisma.subUnit.updateMany({ where: { id: subUnitIds[i], unitId }, data: { orderIndex: i } });
  }
  res.json({ message: "小單元順序已更新" });
});

unitsRouter.put("/:courseId/:unitId/subunits/:subUnitId", async (req, res) => {
  const unitId = Number(req.params.unitId);
  const subUnitId = Number(req.params.subUnitId);
  const data: Record<string, unknown> = {};
  if (typeof req.body?.title === "string") data.title = req.body.title.trim();
  if (typeof req.body?.description === "string") data.description = req.body.description;
  if (typeof req.body?.is_hidden === "boolean") data.isHidden = req.body.is_hidden ? 1 : 0;
  if (typeof req.body?.order_index === "number") data.orderIndex = req.body.order_index;

  const result = await prisma.subUnit.updateMany({ where: { id: subUnitId, unitId }, data });
  if (result.count === 0) {
    res.status(404).json({ detail: "Sub-unit not found" });
    return;
  }
  res.json({ message: "小單元已更新" });
});

unitsRouter.delete("/:courseId/:unitId/subunits/:subUnitId", async (req, res) => {
  await prisma.subUnit.deleteMany({ where: { id: Number(req.params.subUnitId), unitId: Number(req.params.unitId) } });
  res.json({ message: "小單元已刪除" });
});

// --- Materials ---

unitsRouter.post(
  "/:courseId/:unitId/subunits/:subUnitId/materials",
  upload.single("file"),
  async (req, res) => {
    const courseId = Number(req.params.courseId);
    const unitId = Number(req.params.unitId);
    const subUnitId = Number(req.params.subUnitId);
    const subUnit = await prisma.subUnit.findFirst({ where: { id: subUnitId, unitId } });
    if (!subUnit) {
      res.status(404).json({ detail: "Sub-unit not found" });
      return;
    }

    const type: string = req.body?.type ?? (req.file ? "file" : "link");
    let url: string;
    let title: string;

    if (type === "file") {
      const file = req.file;
      if (!file) {
        res.status(400).json({ detail: "請選擇要上傳的檔案" });
        return;
      }
      const materialsDir = path.join(getUploadsDir(), "materials", String(courseId), String(unitId));
      fs.mkdirSync(materialsDir, { recursive: true });
      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      fs.writeFileSync(path.join(materialsDir, filename), file.buffer);
      url = `/uploads/materials/${courseId}/${unitId}/${filename}`;
      title = (req.body?.title as string | undefined)?.trim() || file.originalname;
    } else {
      url = (req.body?.url ?? "").trim();
      if (!url) {
        res.status(400).json({ detail: "請輸入連結網址" });
        return;
      }
      title = (req.body?.title as string | undefined)?.trim() || url;
    }

    const maxOrder = await prisma.material.aggregate({ where: { subUnitId }, _max: { orderIndex: true } });
    const material = await prisma.material.create({
      data: { subUnitId, type, title, url, orderIndex: (maxOrder._max.orderIndex ?? 0) + 1 },
    });
    res.json({ id: material.id, url, message: "教材新增成功！" });
  }
);

unitsRouter.delete("/:courseId/:unitId/subunits/:subUnitId/materials/:materialId", async (req, res) => {
  await prisma.material.deleteMany({
    where: { id: Number(req.params.materialId), subUnitId: Number(req.params.subUnitId) },
  });
  res.json({ message: "教材已刪除" });
});

// --- 閱讀進度總覽（教師端） ---

unitsRouter.get("/:courseId/reading_progress", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const totalStudents = await prisma.student.count({ where: { courseId, isActive: 1 } });

  const subUnits = await prisma.subUnit.findMany({
    where: { unit: { courseId } },
    orderBy: [{ unitId: "asc" }, { orderIndex: "asc" }],
    include: { unit: { select: { id: true, title: true } }, readingProgress: true },
  });

  res.json(
    subUnits.map((su) => ({
      sub_unit_id: su.id,
      sub_unit_title: su.title,
      unit_id: su.unit.id,
      unit_title: su.unit.title,
      total_students: totalStudents,
      viewed_count: su.readingProgress.length,
      details: su.readingProgress.map((rp) => ({
        student_id: rp.studentId,
        first_viewed_at: rp.firstViewedAt,
        last_viewed_at: rp.lastViewedAt,
        view_count: rp.viewCount,
      })),
    }))
  );
});
