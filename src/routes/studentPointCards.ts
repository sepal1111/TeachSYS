// 點數卡掃描與收集冊（學生端）：相機/條碼掃描加分、系列班級授權驗證、每日防重複刷、個人卡片收集冊。
import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { requireStudentAuth } from "../middleware/studentAuth";
import { getNowStrTaipei, getTodayStrTaipei } from "../timezone";
import { broadcastToCourse } from "../realtime";
import { getBundleDir } from "../paths";

export const studentPointCardsRouter = autoCatch(Router());
studentPointCardsRouter.use(requireStudentAuth);

function resolveCardImage(theme: string, score: number, customImage?: string | null): string {
  if (customImage && customImage.trim()) {
    return customImage.trim();
  }

  const staticDir = path.join(getBundleDir(), "static");
  const validThemes = ["score_card_A", "score_card_B"];
  const selectedTheme = validThemes.includes(theme) ? theme : "score_card_A";
  const absScore = Math.abs(score);

  const candidateRel = `/static/pic/score_card/${selectedTheme}/${selectedTheme}_${absScore}.jpg`;
  const candidateFull = path.join(staticDir, "pic", "score_card", selectedTheme, `${selectedTheme}_${absScore}.jpg`);

  if (fs.existsSync(candidateFull)) {
    return candidateRel;
  }

  // Fallback: 若無剛好對應的面額圖檔，尋找同系列任一張或預設圖
  const fallbackRel = `/static/pic/score_card/${selectedTheme}/${selectedTheme}_1.jpg`;
  return fallbackRel;
}

// 1. 學生掃描點數卡加分
studentPointCardsRouter.post("/scan", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const code = String(req.body?.code ?? "").trim();
  if (!code) {
    res.status(400).json({ detail: "請掃描或輸入點數卡代碼" });
    return;
  }

  const card = await prisma.pointCard.findUnique({
    where: { courseId_code: { courseId, code } },
    include: { series: true },
  });

  if (!card) {
    res.status(404).json({ detail: "找不到這張點數卡，請確認掃描內容或向老師確認" });
    return;
  }

  // 1. 驗證系列班級授權
  if (card.series && card.series.allowedCourseIds) {
    const allowed = card.series.allowedCourseIds
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => !isNaN(x));

    if (allowed.length > 0 && !allowed.includes(courseId)) {
      res.status(403).json({ detail: "本班級未獲授權使用此系列的點數卡！" });
      return;
    }
  }

  // 2. 驗證每日防重複刷限制 (每人每日限刷同一張卡一次)
  const today = getTodayStrTaipei();
  const existing = await prisma.pointCardRedemption.findUnique({
    where: { pointCardId_studentId_date: { pointCardId: card.id, studentId, date: today } },
  });

  if (existing) {
    res.status(400).json({ detail: "你今天已經刷過這張點數卡了，明天再試試看吧！" });
    return;
  }

  const now = getNowStrTaipei();
  const log = await prisma.scoreLog.create({
    data: {
      courseId,
      studentId,
      ruleId: null,
      ruleTitle: `🎫 ${card.label}`,
      score: card.score,
      category: card.score >= 0 ? "positive" : "negative",
      date: today,
      timestamp: now,
    },
  });

  await prisma.pointCardRedemption.create({
    data: { pointCardId: card.id, studentId, scoreLogId: log.id, date: today, timestamp: now },
  });

  const cardTheme = card.series?.cardTheme ?? "score_card_A";
  const cardImage = resolveCardImage(cardTheme, card.score, card.image);

  // 透過 WebSocket 即時通知教師端與大螢幕更新
  broadcastToCourse(courseId, "score_updated");

  res.json({
    card_value: card.score,
    card_code: card.code,
    card_no: card.cardNo ?? "",
    label: card.label,
    card_image: cardImage,
    message: `成功獲得「${card.label}」${card.score >= 0 ? "+" : ""}${card.score} 分！`,
  });
});

// 2. 取得個人點數卡收集冊歷史
studentPointCardsRouter.get("/my-cards", async (req, res) => {
  const { studentId } = req.studentAuth!;

  const redemptions = await prisma.pointCardRedemption.findMany({
    where: { studentId },
    include: {
      pointCard: {
        include: { series: true },
      },
    },
    orderBy: { timestamp: "desc" },
  });

  // 依日期（date: YYYY-MM-DD）分組
  const dateGroupMap = new Map<string, { date: string; total_score: number; cards: any[] }>();

  for (const r of redemptions) {
    const card = r.pointCard;
    const theme = card.series?.cardTheme ?? "score_card_A";
    const img = resolveCardImage(theme, card.score, card.image);

    const cardItem = {
      id: r.id,
      card_no: card.cardNo ?? "",
      code: card.code,
      label: card.label,
      score: card.score,
      image: img,
      series_name: card.series?.name ?? "未分類",
      timestamp: r.timestamp,
    };

    const group = dateGroupMap.get(r.date) ?? {
      date: r.date,
      total_score: 0,
      cards: [],
    };
    group.total_score += card.score;
    group.cards.push(cardItem);
    dateGroupMap.set(r.date, group);
  }

  const groupedList = Array.from(dateGroupMap.values());
  res.json({
    total_cards: redemptions.length,
    groups: groupedList,
  });
});
