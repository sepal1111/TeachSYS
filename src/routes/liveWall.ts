// 即時互動牆（Live Wall，教師端）——開一個限時場次，學生每人限交一則文字/手繪/拍照貼文，
// 教師端與投影大螢幕即時呈現。學生端對應路由見 src/routes/studentLiveWall.ts。
import { Router } from "express";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { getNowStrTaipei } from "../timezone";
import { broadcastToCourse } from "../realtime";

export const liveWallRouter = autoCatch(Router());

const VALID_MODES = new Set(["text", "drawing", "photo"]);

function serializePost(p: { id: number; textContent: string | null; imageUrl: string | null; createdAt: string; student: { id: number; studentNumber: number; name: string } }) {
  return {
    id: p.id,
    student_id: p.student.id,
    student_number: p.student.studentNumber,
    student_name: p.student.name,
    text_content: p.textContent,
    image_url: p.imageUrl,
    created_at: p.createdAt,
  };
}

function serializeSession(s: { id: number; courseId: number; mode: string; title: string | null; showNames: number; createdAt: string }) {
  return {
    id: s.id,
    course_id: s.courseId,
    mode: s.mode,
    title: s.title,
    show_names: !!s.showNames,
    created_at: s.createdAt,
  };
}

// 開始新場次：自動關閉該課程既有進行中的場次，不需要老師先手動結束再開新的。
liveWallRouter.post("/courses/:courseId/start", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const mode: string = req.body?.mode;
  if (!VALID_MODES.has(mode)) {
    res.status(400).json({ detail: "請選擇有效的提交模式（文字／手繪／拍照）" });
    return;
  }
  const title: string | null = (req.body?.title as string | undefined)?.trim() || null;
  const showNames = req.body?.show_names === false ? 0 : 1;

  await prisma.liveSession.updateMany({ where: { courseId, isActive: 1 }, data: { isActive: 0 } });
  const session = await prisma.liveSession.create({
    data: { courseId, mode, title, showNames, isActive: 1, createdAt: getNowStrTaipei() },
  });

  broadcastToCourse(courseId, "live_wall_updated");
  res.json(serializeSession(session));
});

// 目前進行中場次＋全部貼文（教師視角一律看得到真名，匿名只影響投影/學生視角）。
liveWallRouter.get("/courses/:courseId/active", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const session = await prisma.liveSession.findFirst({ where: { courseId, isActive: 1 } });
  if (!session) {
    res.json({ session: null, posts: [] });
    return;
  }
  const posts = await prisma.liveWallPost.findMany({
    where: { sessionId: session.id },
    orderBy: { id: "asc" },
    include: { student: true },
  });
  res.json({ session: serializeSession(session), posts: posts.map(serializePost) });
});

// 一鍵清空：只刪貼文，場次維持開啟，學生可以重新送出一次。
liveWallRouter.post("/sessions/:sessionId/clear", async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ detail: "場次不存在" });
    return;
  }
  await prisma.liveWallPost.deleteMany({ where: { sessionId } });
  broadcastToCourse(session.courseId, "live_wall_updated");
  res.json({ message: "已清空所有貼文" });
});

// 結束場次：與「清空」是獨立動作，結束後學生端恢復成沒有進行中場次的畫面。
liveWallRouter.post("/sessions/:sessionId/close", async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ detail: "場次不存在" });
    return;
  }
  await prisma.liveSession.update({ where: { id: sessionId }, data: { isActive: 0 } });
  broadcastToCourse(session.courseId, "live_wall_updated");
  res.json({ message: "場次已結束" });
});
