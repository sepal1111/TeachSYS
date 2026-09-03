// 點數卡管理（教師端）：系列管理、授權班級、Excel/CSV 匯入、批次移動/刪除、使用統計。
// 學生掃描端見 routes/studentPointCards.ts。
import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { getNowStrTaipei } from "../timezone";
import { parseCsvPointCards, parseExcelPointCards, ParsedPointCard } from "../utils/pointCardImport";

export const pointCardsRouter = autoCatch(Router());
const upload = multer({ storage: multer.memoryStorage() });

// 0. 範本下載 (必須放在 /:courseId 之前，避免被捕獲)
pointCardsRouter.get("/template/csv", (_req, res) => {
  const headers = ["序列號", "卡號", "名稱", "分數"];
  const sample = [
    ["A-001", "CARD-0001", "認真發言", 2],
    ["A-002", "CARD-0002", "熱心助人", 1],
    ["A-003", "CARD-0003", "作業特優", 5],
    ["A-004", "CARD-0004", "上課吵鬧", -1],
  ];
  const lines = [headers, ...sample].map((row) => row.join(","));
  const content = "\uFEFF" + lines.join("\r\n") + "\r\n";
  const filename = encodeURIComponent("實體點數卡匯入範例.csv");
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
  });
  res.send(Buffer.from(content, "utf-8"));
});

pointCardsRouter.get("/template/excel", async (_req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("點數卡名單");

  sheet.columns = [
    { header: "序列號", key: "card_no", width: 14 },
    { header: "卡號 (QR碼內容)", key: "code", width: 22 },
    { header: "卡片名稱", key: "label", width: 20 },
    { header: "點數分數", key: "score", width: 14 },
  ];

  sheet.addRow({ card_no: "A-001", code: "CARD-0001", label: "認真發言", score: 2 });
  sheet.addRow({ card_no: "A-002", code: "CARD-0002", label: "熱心助人", score: 1 });
  sheet.addRow({ card_no: "A-003", code: "CARD-0003", label: "作業特優", score: 5 });
  sheet.addRow({ card_no: "A-004", code: "CARD-0004", label: "課堂表現優良", score: 10 });
  sheet.addRow({ card_no: "A-005", code: "CARD-0005", label: "上課分心", score: -1 });

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B7CD6" } };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = encodeURIComponent("實體點數卡匯入範例.xlsx");
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
  });
  res.send(Buffer.from(buffer));
});

// 1. 取得課程點數卡清單（含所屬系列與兌換次數）
pointCardsRouter.get("/:courseId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (isNaN(courseId)) {
    res.status(400).json({ detail: "無效的課程 ID" });
    return;
  }
  const cards = await prisma.pointCard.findMany({
    where: { courseId },
    include: {
      series: true,
      _count: { select: { redemptions: true } },
    },
    orderBy: [{ seriesId: "asc" }, { id: "asc" }],
  });

  const formatted = cards.map((c) => ({
    id: c.id,
    course_id: c.courseId,
    series_id: c.seriesId,
    series_name: c.series?.name ?? "未分類",
    card_theme: c.series?.cardTheme ?? "score_card_A",
    card_no: c.cardNo ?? "",
    code: c.code,
    label: c.label,
    score: c.score,
    image: c.image ?? "",
    created_at: c.createdAt,
    redemption_count: c._count.redemptions,
  }));

  res.json(formatted);
});

// 2. 批次匯入點數卡（支援 Excel .xlsx / .xls 與 .csv）
pointCardsRouter.post("/:courseId/upload", upload.single("file"), async (req, res) => {
  const courseId = Number(req.params.courseId);
  const file = req.file;
  if (!file) {
    res.status(400).json({ detail: "請選擇要上傳的 Excel 或 CSV 檔案" });
    return;
  }

  const fileName = file.originalname.toLowerCase();
  let rows: ParsedPointCard[] = [];

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    rows = await parseExcelPointCards(file.buffer);
  } else if (fileName.endsWith(".csv")) {
    rows = parseCsvPointCards(file.buffer.toString("utf-8"));
  } else {
    res.status(400).json({ detail: "僅支援 .xlsx, .xls 或 .csv 檔案格式" });
    return;
  }

  if (rows.length === 0) {
    res.status(400).json({ detail: "檔案中未找到有效的點數卡資料，請確認包含卡號與分數欄位" });
    return;
  }

  // 檢查是否指定或自動建立系列
  let seriesId: number | null = null;
  const seriesIdParam = req.body?.series_id;
  const newSeriesName = String(req.body?.new_series_name ?? "").trim();
  const cardTheme = String(req.body?.card_theme ?? "score_card_A").trim();

  const now = getNowStrTaipei();

  if (newSeriesName) {
    const createdSeries = await prisma.pointCardSeries.create({
      data: {
        courseId,
        name: newSeriesName,
        cardTheme: cardTheme || "score_card_A",
        allowedCourseIds: String(courseId),
        createdAt: now,
      },
    });
    seriesId = createdSeries.id;
  } else if (seriesIdParam && seriesIdParam !== "uncategorized" && seriesIdParam !== "none") {
    seriesId = Number(seriesIdParam);
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const existing = await prisma.pointCard.findUnique({
      where: { courseId_code: { courseId, code: row.code } },
    });

    await prisma.pointCard.upsert({
      where: { courseId_code: { courseId, code: row.code } },
      update: {
        label: row.label,
        score: row.score,
        cardNo: row.cardNo ?? existing?.cardNo ?? null,
        image: row.image ?? existing?.image ?? null,
        ...(seriesId != null ? { seriesId } : {}),
      },
      create: {
        courseId,
        seriesId,
        cardNo: row.cardNo ?? null,
        code: row.code,
        label: row.label,
        score: row.score,
        image: row.image ?? null,
        createdAt: now,
      },
    });

    if (existing) updatedCount++;
    else createdCount++;
  }

  res.json({
    created_count: createdCount,
    updated_count: updatedCount,
    series_id: seriesId,
    message: `匯入完成：新增 ${createdCount} 張、更新 ${updatedCount} 張點數卡`,
  });
});

// 3. 系列管理 API
pointCardsRouter.get("/:courseId/series", async (req, res) => {
  const courseId = Number(req.params.courseId);

  // 確保預設的兩個系列「竹塹風情」與「台灣之美」必定存在
  const now = getNowStrTaipei();
  const hasZhuqian = await prisma.pointCardSeries.findFirst({ where: { name: "竹塹風情" } });
  if (!hasZhuqian) {
    await prisma.pointCardSeries.create({
      data: {
        courseId: null,
        name: "竹塹風情",
        cardTheme: "score_card_A",
        allowedCourseIds: "",
        createdAt: now,
      },
    });
  }

  const hasTaiwan = await prisma.pointCardSeries.findFirst({ where: { name: "台灣之美" } });
  if (!hasTaiwan) {
    await prisma.pointCardSeries.create({
      data: {
        courseId: null,
        name: "台灣之美",
        cardTheme: "score_card_B",
        allowedCourseIds: "",
        createdAt: now,
      },
    });
  }

  const series = await prisma.pointCardSeries.findMany({
    where: {
      OR: [
        { courseId },
        { courseId: null },
        { allowedCourseIds: "" },
        { allowedCourseIds: { contains: String(courseId) } },
      ],
    },
    include: {
      _count: { select: { cards: true } },
    },
    orderBy: { id: "asc" },
  });

  const allCourses = await prisma.course.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  const formatted = series.map((s) => {
    const allowedIds = s.allowedCourseIds
      ? s.allowedCourseIds.split(",").map((x) => Number(x.trim())).filter((x) => !isNaN(x))
      : [];
    return {
      id: s.id,
      name: s.name,
      card_theme: s.cardTheme,
      allowed_course_ids: allowedIds,
      card_count: s._count.cards,
      created_at: s.createdAt,
    };
  });

  res.json({ series: formatted, courses: allCourses });
});

// 新增或更新系列
pointCardsRouter.post("/:courseId/series", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { id, name, card_theme, allowed_course_ids } = req.body;

  if (!name || !String(name).trim()) {
    res.status(400).json({ detail: "系列名稱不可為空" });
    return;
  }

  const allowedStr = Array.isArray(allowed_course_ids)
    ? allowed_course_ids.join(",")
    : String(allowed_course_ids ?? courseId);

  const theme = String(card_theme || "score_card_A");
  const now = getNowStrTaipei();

  if (id) {
    const updated = await prisma.pointCardSeries.update({
      where: { id: Number(id) },
      data: {
        name: String(name).trim(),
        cardTheme: theme,
        allowedCourseIds: allowedStr,
      },
    });
    res.json({ message: "系列已更新", series: updated });
  } else {
    const created = await prisma.pointCardSeries.create({
      data: {
        courseId,
        name: String(name).trim(),
        cardTheme: theme,
        allowedCourseIds: allowedStr,
        createdAt: now,
      },
    });
    res.json({ message: "系列已建立", series: created });
  }
});

// 刪除系列（卡片轉為未分類）
pointCardsRouter.delete("/:courseId/series/:seriesId", async (req, res) => {
  const seriesId = Number(req.params.seriesId);
  await prisma.pointCard.updateMany({
    where: { seriesId },
    data: { seriesId: null },
  });
  await prisma.pointCardSeries.delete({ where: { id: seriesId } });
  res.json({ message: "系列已刪除，原卡片已轉為未分類" });
});

// 4. 批次操作
// 批次移動卡片所屬系列
pointCardsRouter.post("/:courseId/batch-move", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const cardIds: number[] = Array.isArray(req.body?.card_ids) ? req.body.card_ids.map(Number) : [];
  const targetSeriesId = req.body?.target_series_id ? Number(req.body.target_series_id) : null;

  if (cardIds.length === 0) {
    res.status(400).json({ detail: "請選擇要移動的卡片" });
    return;
  }

  await prisma.pointCard.updateMany({
    where: { courseId, id: { in: cardIds } },
    data: { seriesId: targetSeriesId },
  });

  res.json({ message: `成功將 ${cardIds.length} 張卡片移動至指定系列` });
});

// 批次刪除卡片
pointCardsRouter.post("/:courseId/batch-delete", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const cardIds: number[] = Array.isArray(req.body?.card_ids) ? req.body.card_ids.map(Number) : [];

  if (cardIds.length === 0) {
    res.status(400).json({ detail: "請選擇要刪除的卡片" });
    return;
  }

  await prisma.pointCard.deleteMany({
    where: { courseId, id: { in: cardIds } },
  });

  res.json({ message: `成功刪除 ${cardIds.length} 張點數卡` });
});

// 清空全部點數卡
pointCardsRouter.delete("/:courseId/clear", async (req, res) => {
  const courseId = Number(req.params.courseId);
  await prisma.pointCard.deleteMany({ where: { courseId } });
  res.json({ message: "已清空全部點數卡" });
});

// 刪除單張點數卡
pointCardsRouter.delete("/:courseId/:cardId", async (req, res) => {
  await prisma.pointCard.deleteMany({
    where: { id: Number(req.params.cardId), courseId: Number(req.params.courseId) },
  });
  res.json({ message: "點數卡已刪除" });
});

// 5. 點數卡使用統計
pointCardsRouter.get("/:courseId/stats", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const totalCards = await prisma.pointCard.count({ where: { courseId } });
  const redemptions = await prisma.pointCardRedemption.findMany({
    where: { pointCard: { courseId } },
    include: {
      pointCard: true,
      student: true,
    },
  });

  const totalRedeemed = redemptions.length;
  const cardStatsMap = new Map<number, { label: string; score: number; count: number }>();
  const studentStatsMap = new Map<number, { name: string; number: number; totalScore: number; count: number }>();

  for (const r of redemptions) {
    // 卡片使用次數
    const cStat = cardStatsMap.get(r.pointCardId) ?? {
      label: r.pointCard.label,
      score: r.pointCard.score,
      count: 0,
    };
    cStat.count++;
    cardStatsMap.set(r.pointCardId, cStat);

    // 學生兌換排行
    const sStat = studentStatsMap.get(r.studentId) ?? {
      name: r.student.name,
      number: r.student.studentNumber,
      totalScore: 0,
      count: 0,
    };
    sStat.count++;
    sStat.totalScore += r.pointCard.score;
    studentStatsMap.set(r.studentId, sStat);
  }

  const topCards = Array.from(cardStatsMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  const topStudents = Array.from(studentStatsMap.values()).sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

  res.json({
    total_cards: totalCards,
    total_redemptions: totalRedeemed,
    top_cards: topCards,
    top_students: topStudents,
  });
});

