// 即時互動牆（Live Wall，學生端）——公開路由（router 內自行套用 requireStudentAuth），
// 對應教師端 src/routes/liveWall.ts。學生每人每場次限交一則文字/手繪/拍照貼文。
import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { requireStudentAuth } from "../middleware/studentAuth";
import { getNowStrTaipei } from "../timezone";
import { getUploadsDir } from "../paths";
import { broadcastToCourse } from "../realtime";

export const studentLiveWallRouter = autoCatch(Router());
studentLiveWallRouter.use(requireStudentAuth);

const upload = multer({ storage: multer.memoryStorage() });

function serializePost(p: { textContent: string | null; imageUrl: string | null; createdAt: string }) {
  return { text_content: p.textContent, image_url: p.imageUrl, created_at: p.createdAt };
}

// 目前課程進行中場次＋「我是否已經交過、交了什麼」，讓重新整理頁面不會讓學生
// 重新看到輸入表單或重複送出——courseId/studentId 一律來自 JWT，不接受前端參數。
studentLiveWallRouter.get("/active", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const session = await prisma.liveSession.findFirst({ where: { courseId, isActive: 1 } });
  if (!session) {
    res.json({ session: null, my_post: null });
    return;
  }
  const myPost = await prisma.liveWallPost.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
  });
  res.json({
    session: { id: session.id, mode: session.mode, title: session.title, show_names: !!session.showNames },
    my_post: myPost ? serializePost(myPost) : null,
  });
});

studentLiveWallRouter.post("/submit", upload.single("file"), async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const session = await prisma.liveSession.findFirst({ where: { courseId, isActive: 1 } });
  if (!session) {
    res.status(400).json({ detail: "目前沒有進行中的課堂互動" });
    return;
  }

  const existing = await prisma.liveWallPost.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
  });
  if (existing) {
    res.status(400).json({ detail: "你已經送出過了，請等待老師查看" });
    return;
  }

  let textContent: string | null = null;
  let imageUrl: string | null = null;

  if (session.mode === "text") {
    textContent = (req.body?.text_content ?? "").trim();
    if (!textContent) {
      res.status(400).json({ detail: "請輸入想分享的內容" });
      return;
    }
  } else {
    // drawing 與 photo 存檔方式完全相同（都是一張圖片），差異只在學生端的擷取方式
    // （canvas.toBlob 匯出 vs. 相機/相簿選取），伺服器端不需要區分。
    const file = req.file;
    if (!file) {
      res.status(400).json({ detail: "請先完成手繪或選擇照片" });
      return;
    }
    const dir = path.join(getUploadsDir(), "live_wall", String(courseId), String(session.id));
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(dir, filename), file.buffer);
    imageUrl = `/uploads/live_wall/${courseId}/${session.id}/${filename}`;
  }

  const post = await prisma.liveWallPost.create({
    data: { sessionId: session.id, studentId, textContent, imageUrl, createdAt: getNowStrTaipei() },
  });

  broadcastToCourse(courseId, "live_wall_updated");
  res.json(serializePost(post));
});
