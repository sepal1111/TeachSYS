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

export function resolveCardImage(theme: string, score: number, customImage?: string | null): string {
  const validThemes = ["score_card_A", "score_card_B"];
  const selectedTheme = validThemes.includes(theme) ? theme : "score_card_A";

  if (customImage && customImage.trim()) {
    const trimmed = customImage.trim();
    if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
      return trimmed;
    }
    // 如果是像 "score_card_A_4.jpg" 的純檔名，轉為完整的靜態網址
    if (trimmed.startsWith("score_card_B_")) {
      return `/static/pic/score_card/score_card_B/${trimmed}`;
    }
    if (trimmed.startsWith("score_card_A_")) {
      return `/static/pic/score_card/score_card_A/${trimmed}`;
    }
    return `/static/pic/score_card/${selectedTheme}/${trimmed}`;
  }

  const staticDir = path.join(getBundleDir(), "static");
  const absScore = Math.abs(score);

  const candidateRel = `/static/pic/score_card/${selectedTheme}/${selectedTheme}_${absScore}.jpg`;
  const candidateFull = path.join(staticDir, "pic", "score_card", selectedTheme, `${selectedTheme}_${absScore}.jpg`);

  if (fs.existsSync(candidateFull)) {
    return candidateRel;
  }

  // Fallback: 若無剛好對應的面額圖檔，尋找同系列預設圖
  const fallbackRel = `/static/pic/score_card/${selectedTheme}/${selectedTheme}_1.jpg`;
  return fallbackRel;
}

export function getSafeCardLabel(card: { label?: string | null; code?: string | null; series?: { name: string } | null; cardNo?: string | null }): string {
  const lbl = (card.label || "").trim();
  const cde = (card.code || "").trim();
  // 嚴格防護：若 label 為空、或等於 code、或為十六進位/隨機卡號代碼，一律替換為系列名稱，絕對不可洩露 card_code
  if (!lbl || lbl.toLowerCase() === cde.toLowerCase() || /^[a-z0-9]{6,16}$/i.test(lbl)) {
    if (card.series && card.series.name && card.series.name.trim()) {
      return card.series.name.trim();
    }
    return "榮譽點數卡";
  }
  return lbl;
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
  const safeLabel = getSafeCardLabel(card);

  const cardNoSuffix = card.cardNo ? ` (卡號：${card.cardNo})` : "";
  const log = await prisma.scoreLog.create({
    data: {
      courseId,
      studentId,
      ruleId: null,
      ruleTitle: `🎫 ${safeLabel}${cardNoSuffix}`,
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
    card_no: card.cardNo ?? "",
    label: safeLabel,
    card_image: cardImage,
    series_name: card.series?.name ?? "未分類",
    message: `成功獲得「${safeLabel}」${card.score >= 0 ? "+" : ""}${card.score} 分！`,
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
    const safeLabel = getSafeCardLabel(card);

    const cardItem = {
      id: r.id,
      card_no: card.cardNo ?? "",
      label: safeLabel,
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
