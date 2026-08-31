// Port of app/routers/system.py (minus the WebSocket endpoint, now handled by
// src/realtime.ts via Socket.io — see setupRealtime()).
import fs from "fs";
import os from "os";
import path from "path";
import { Router } from "express";
import multer from "multer";
import QRCode from "qrcode";
import { prisma } from "../db";
import { getBinDir, getBundleDir } from "../paths";
import { getTodayMMDDTaipei, getTodayStrTaipei } from "../timezone";
import { createSession, getCurrentSessionToken, isRequestAuthenticated, requireAuth } from "../middleware/auth";

export const systemRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- Network & System Info ---

function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

systemRouter.get("/info", async (req, res) => {
  const port = Number(req.query.port ?? 8000);
  const courseId = req.query.course_id ? Number(req.query.course_id) : undefined;
  const mode = (req.query.mode as string) ?? "mobile";

  const localIp = getLocalIp();
  const baseUrl = `http://${localIp}:${port}`;
  const mobileUrl = courseId ? `${baseUrl}/?mobile=1&course_id=${courseId}` : `${baseUrl}/?mobile=1`;
  const targetUrl = mode === "mobile" ? mobileUrl : baseUrl;

  const qrDataUrl = await QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: "L",
    margin: 2,
    scale: 8,
  });

  res.json({
    local_ip: localIp,
    port,
    url: targetUrl,
    base_url: baseUrl,
    mobile_url: mobileUrl,
    qr_code: qrDataUrl,
  });
});

// --- Password & Auth Endpoints ---

async function getPasswordPrefix(): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key: "password_prefix" } });
  return row?.value || "Admin";
}

systemRouter.get("/auth_info", async (req, res) => {
  res.json({
    today_str: getTodayStrTaipei(),
    today_mmdd: getTodayMMDDTaipei(),
    default_prefix: "Admin",
    authenticated: await isRequestAuthenticated(req),
  });
});

systemRouter.get("/check_auth", async (req, res) => {
  res.json({
    authenticated: await isRequestAuthenticated(req),
    today_str: getTodayStrTaipei(),
  });
});

systemRouter.post("/verify_password", async (req, res) => {
  const password = String(req.body?.password ?? "");
  const prefix = await getPasswordPrefix();
  const todayMmdd = getTodayMMDDTaipei();
  const expected = `${prefix}${todayMmdd}`;

  if (password.trim() !== expected) {
    res.status(401).json({ detail: `密碼錯誤！密碼公式為：[字頭] + [當天月日${todayMmdd}]` });
    return;
  }

  const token = await createSession();
  res.cookie("auth_session", token, {
    maxAge: 86400 * 1000,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
  res.json({ success: true, message: "身分驗證成功！", auth_token: token, auth_date: getTodayStrTaipei() });
});

systemRouter.post("/logout", async (req, res) => {
  const token = getCurrentSessionToken(req);
  if (token) {
    await prisma.systemSession.deleteMany({ where: { token } });
  }
  res.clearCookie("auth_session", { path: "/" });
  res.json({ success: true, message: "已成功登出系統！" });
});

systemRouter.post("/update_password_prefix", requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.current_password ?? "");
  const newPrefixRaw = String(req.body?.new_prefix ?? "");
  const prefix = await getPasswordPrefix();
  const todayMmdd = getTodayMMDDTaipei();
  const expected = `${prefix}${todayMmdd}`;

  if (currentPassword.trim() !== expected) {
    res.status(401).json({ detail: "目前密碼驗證失敗！" });
    return;
  }

  const newPrefix = newPrefixRaw.trim();
  if (newPrefix.length < 4) {
    res.status(400).json({ detail: "密碼字頭長度至少必須為 4 碼！" });
    return;
  }

  await prisma.systemSetting.upsert({
    where: { key: "password_prefix" },
    update: { value: newPrefix },
    create: { key: "password_prefix", value: newPrefix },
  });

  res.json({
    success: true,
    message: `密碼字頭已成功修改為『${newPrefix}』！今日最新密碼為：${newPrefix}${todayMmdd}`,
  });
});

systemRouter.post("/reset_password_prefix", async (_req, res) => {
  await prisma.systemSetting.upsert({
    where: { key: "password_prefix" },
    update: { value: "Admin" },
    create: { key: "password_prefix", value: "Admin" },
  });
  const todayMmdd = getTodayMMDDTaipei();
  res.json({ success: true, message: `密碼字頭已成功恢復為預設『Admin』！今日密碼為：Admin${todayMmdd}` });
});

// --- Logo & Favicon 自訂替換支援 ---

function getCustomLogoPath(): string {
  return path.join(getBinDir(), "custom_logo.png");
}
function getDefaultLogoPath(): string {
  return path.join(getBundleDir(), "static", "logo.svg");
}

systemRouter.get("/logo", (_req, res) => {
  const custom = getCustomLogoPath();
  if (fs.existsSync(custom)) {
    res.sendFile(custom, { headers: { "Content-Type": "image/png" } });
    return;
  }
  const defaultSvg = getDefaultLogoPath();
  if (fs.existsSync(defaultSvg)) {
    res.sendFile(defaultSvg, { headers: { "Content-Type": "image/svg+xml" } });
    return;
  }
  res.json({ message: "Logo not found" });
});

systemRouter.post("/logo", requireAuth, upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ detail: "請上傳 PNG、JPG 或 SVG 圖片檔案！" });
    return;
  }
  const filename = file.originalname.toLowerCase();
  if (!/\.(png|jpg|jpeg|svg|webp)$/.test(filename)) {
    res.status(400).json({ detail: "請上傳 PNG、JPG 或 SVG 圖片檔案！" });
    return;
  }
  fs.writeFileSync(getCustomLogoPath(), file.buffer);
  res.json({ success: true, message: "Logo 與 Favicon 已成功替換！" });
});

systemRouter.post("/logo/reset", requireAuth, (_req, res) => {
  const custom = getCustomLogoPath();
  if (fs.existsSync(custom)) {
    try {
      fs.unlinkSync(custom);
    } catch {
      /* best-effort */
    }
  }
  res.json({ success: true, message: "已成功恢復為系統預設 Logo！" });
});

systemRouter.get("/bgm_list", (_req, res) => {
  const musicDir = path.join(getBundleDir(), "static", "music");
  const musicList: { title: string; filename: string; url: string }[] = [];
  if (fs.existsSync(musicDir)) {
    const exts = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);
    for (const f of fs.readdirSync(musicDir).sort()) {
      const ext = path.extname(f).toLowerCase();
      if (exts.has(ext)) {
        musicList.push({ title: path.basename(f, ext), filename: f, url: `/static/music/${f}` });
      }
    }
  }
  res.json({ music: musicList });
});
