// Port of app/main.py + run_server.py.
import fs from "fs";
import net from "net";
import path from "path";
import https from "https";
import { exec } from "child_process";
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import QRCode from "qrcode";

import { initSchema } from "./db";
import { getBinDir, getBundleDir, getUploadsDir } from "./paths";
import { isRequestAuthenticated, requireAuth } from "./middleware/auth";
import { getBearerToken, verifyStudentToken } from "./middleware/studentAuth";
import { setupRealtime } from "./realtime";
import { autoCatch } from "./asyncRoute";
import { getOrCreateHttpsOptions } from "./tls";

import { systemRouter } from "./routes/system";
import { coursesRouter } from "./routes/courses";
import { attendanceRouter } from "./routes/attendance";
import { groupsRouter } from "./routes/groups";
import { seatingRouter } from "./routes/seating";
import { scoresRouter } from "./routes/scores";
import { notesRouter } from "./routes/notes";
import { reportsRouter } from "./routes/reports";
import { unitsRouter } from "./routes/units";
import { studentAuthRouter } from "./routes/studentAuth";
import { studentContentRouter } from "./routes/studentContent";
import { liveWallRouter } from "./routes/liveWall";
import { studentLiveWallRouter } from "./routes/studentLiveWall";
import { pointCardsRouter } from "./routes/pointCards";
import { studentPointCardsRouter } from "./routes/studentPointCards";
import { rewardsRouter } from "./routes/rewards";
import { studentRewardsRouter } from "./routes/studentRewards";

const APP_STARTUP_TIMESTAMP = String(Date.now());
const bundleDir = getBundleDir();
const staticDir = path.join(bundleDir, "static");
const binDir = getBinDir();
const uploadsDir = getUploadsDir();
const photoDir = path.join(binDir, "photo");
fs.mkdirSync(path.join(uploadsDir, "notes"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "groups"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "live_wall"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "rewards"), { recursive: true });
fs.mkdirSync(photoDir, { recursive: true });

const app = express();
autoCatch(app);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- HTTP Middleware: force no-cache on static/html/js/css/json, mirroring main.py ---
app.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path;
  if (
    p.startsWith("/static") ||
    /\.(html|js|css|json)$/.test(p) ||
    ["", "/", "/projection", "/guide", "/student", "/favicon.ico"].includes(p)
  ) {
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    });
  }
  next();
});

function renderCachedHtml(res: Response, filePath: string) {
  try {
    let content = fs.readFileSync(filePath, "utf-8");
    content = content.replace(/(\.js|\.css)(\?v=[^"'\s>]+)?/g, `$1?v=${APP_STARTUP_TIMESTAMP}`);
    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.send(content);
  } catch {
    res.status(500).send("Page loading error");
  }
}

app.use("/static", express.static(staticDir));

// --- Secure access for student photos and note/group attachments ---
/** Resolves `rel` under `baseDir`, rejecting any path that escapes it via `..`. */
function resolveSafePath(baseDir: string, rel: string): string | null {
  const resolved = path.resolve(baseDir, rel);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

app.get("/photo/*", async (req, res) => {
  if (!(await isRequestAuthenticated(req))) {
    res.status(401).json({ detail: "未登入無法讀取學生照片" });
    return;
  }
  const rel = (req.params as Record<string, string>)[0] ?? "";
  const filePath = resolveSafePath(photoDir, rel);
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ detail: "Photo not found" });
  }
});

app.get("/uploads/*", async (req, res) => {
  // 教材/作業附件同時給教師（系統 session）與學生（LMS JWT）存取，兩種驗證只要其一成立即可。
  // 學生端也接受 ?token= query（<img src>/<a href> 無法附加 Authorization header）。
  const token = getBearerToken(req) || (typeof req.query.token === "string" ? req.query.token : undefined);
  const isStudent = token ? Boolean(await verifyStudentToken(token)) : false;
  if (!isStudent && !(await isRequestAuthenticated(req))) {
    res.status(401).json({ detail: "未登入無法讀取系統附件" });
    return;
  }
  const rel = (req.params as Record<string, string>)[0] ?? "";
  const filePath = resolveSafePath(uploadsDir, rel);
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    // 磁碟上的檔名是亂數產生的（避免碰撞），跟素材頁面顯示的標題不同；呼叫端可選擇性帶
    // ?name= 指定下載/另存時要用的檔名（例如素材標題），保留實際副檔名以免存成打不開的檔案。
    const displayName = typeof req.query.name === "string" ? req.query.name.trim() : "";
    if (displayName) {
      const ext = path.extname(filePath);
      const safeBase = displayName.replace(/[\\/]/g, "");
      const finalName = ext && !safeBase.toLowerCase().endsWith(ext.toLowerCase()) ? `${safeBase}${ext}` : safeBase;
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(finalName)}`);
    }
    res.sendFile(filePath);
  } else {
    res.status(404).json({ detail: "File not found" });
  }
});

app.get("/favicon.ico", (_req, res) => {
  const customLogo = path.join(binDir, "custom_logo.png");
  if (fs.existsSync(customLogo)) {
    res.sendFile(customLogo, { headers: { "Content-Type": "image/png" } });
    return;
  }
  const favicon = path.join(staticDir, "logo.svg");
  if (fs.existsSync(favicon)) {
    res.sendFile(favicon, { headers: { "Content-Type": "image/svg+xml" } });
    return;
  }
  res.json({ message: "Favicon not found" });
});

app.get("/", (_req, res) => {
  const indexFile = path.join(staticDir, "index.html");
  if (fs.existsSync(indexFile)) {
    renderCachedHtml(res, indexFile);
  } else {
    res.json({ message: "Server is running, but static/index.html is missing" });
  }
});

app.get("/guide", async (req, res) => {
  if (!(await isRequestAuthenticated(req))) {
    const redirectTarget = req.originalUrl.includes("?") ? req.originalUrl : "/guide";
    res.redirect(307, `/?redirect=${encodeURIComponent(redirectTarget)}`);
    return;
  }
  const guideFile = path.join(staticDir, "guide.html");
  if (fs.existsSync(guideFile)) {
    renderCachedHtml(res, guideFile);
  } else {
    res.json({ message: "Guide page is missing" });
  }
});

app.get("/projection", async (req, res) => {
  if (!(await isRequestAuthenticated(req))) {
    const redirectTarget = req.originalUrl.includes("?") ? req.originalUrl : "/projection";
    res.redirect(307, `/?redirect=${encodeURIComponent(redirectTarget)}`);
    return;
  }
  const projFile = path.join(staticDir, "projection.html");
  const indexFile = path.join(staticDir, "index.html");
  if (fs.existsSync(projFile)) {
    renderCachedHtml(res, projFile);
  } else if (fs.existsSync(indexFile)) {
    renderCachedHtml(res, indexFile);
  } else {
    res.json({ message: "Projection page is missing" });
  }
});

// --- LMS 學生入口頁（Phase 2）：公開頁面，不需要教師系統密碼登入。
// 使用者不再直接輸入這個網址——教師與學生一律從 http://localhost:8000 進入，學生登入成功後
// 由 static/js/app.js 的 enterStudentMode() 把這個頁面載進一個同源全螢幕 iframe 顯示，
// 此路由純粹是那個 iframe 的內部資源來源，保留路徑不變只是為了不用同時改前後端。 ---
app.get("/student", (_req, res) => {
  const studentFile = path.join(staticDir, "student.html");
  if (fs.existsSync(studentFile)) {
    renderCachedHtml(res, studentFile);
  } else {
    res.json({ message: "Student page is missing" });
  }
});

// --- API Routers (each router self-wraps via autoCatch() at construction time,
// in its own file, so a rejected promise in a handler reaches the error
// middleware below instead of crashing the whole server) ---
app.use("/api/system", systemRouter);
app.use("/api/courses", requireAuth, coursesRouter);
app.use("/api/attendance", requireAuth, attendanceRouter);
app.use("/api/groups", requireAuth, groupsRouter);
app.use("/api/seating", requireAuth, seatingRouter);
app.use("/api/scores", requireAuth, scoresRouter);
app.use("/api/notes", requireAuth, notesRouter);
app.use("/api/reports", requireAuth, reportsRouter);
app.use("/api/units", requireAuth, unitsRouter);
app.use("/api/live-wall", requireAuth, liveWallRouter);
app.use("/api/point-cards", requireAuth, pointCardsRouter);
app.use("/api/rewards", requireAuth, rewardsRouter);

// --- LMS 學生端（Phase 2）：獨立的 JWT 驗證，不套用教師 requireAuth ---
app.use("/api/auth/student", studentAuthRouter);
app.use("/api/student", studentContentRouter);
app.use("/api/student/live-wall", studentLiveWallRouter);
app.use("/api/student/point-cards", studentPointCardsRouter);
app.use("/api/student/rewards", studentRewardsRouter);

// --- Global error handler: isolate a single request's failure instead of
// letting an unhandled rejection crash the whole process (all other teachers'
// live connections included). Must be registered last, after every route. ---
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Request Error]", err);
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({ detail: message });
});

// --- Startup: find an available port, boot the DB schema, then listen ---

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(startPort = 8000, maxAttempts = 20): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortFree(port)) return port;
  }
  return startPort;
}

function getLocalIp(): string {
  const os = require("os") as typeof import("os");
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

function openBrowser(url: string) {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => undefined);
}

async function waitForServerReady(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        const req = https.get(
          { host: "127.0.0.1", port, path: "/", timeout: 500, rejectUnauthorized: false },
          (res) => {
            resolve(res.statusCode === 200);
            res.resume();
          }
        );
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
          req.destroy();
          resolve(false);
        });
      });
      if (ok) return;
    } catch {
      /* keep polling */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function printBanner(port: number) {
  const localIp = getLocalIp();
  const localUrl = `https://localhost:${port}`;
  const networkUrl = `https://${localIp}:${port}`;

  console.log("=".repeat(60));
  console.log("  [*] 國小課堂即時記錄系統 (TeachSYS - Node.js Edition)");
  console.log("=".repeat(60));
  console.log(` 本機開啟網址 : ${localUrl}`);
  console.log(` 區網手機/平板 : ${networkUrl}`);
  console.log("-".repeat(60));
  console.log(" 請確保手機/平板與此電腦連線至相同的教室 Wi-Fi 網路！");
  console.log(" 本系統採自簽憑證的 HTTPS，瀏覽器第一次連線會顯示「不安全連線」警告，");
  console.log(" 屬正常現象，請點選「進階」→「繼續前往」即可（相機掃描功能需要 HTTPS 才能使用）。");
  console.log(" 掃描下方 QR Code 即可快速連線：\n");
  try {
    console.log(await QRCode.toString(networkUrl, { type: "terminal", small: true }));
  } catch {
    /* best-effort ASCII QR */
  }
  console.log("=".repeat(60));
}

// Last-resort safety net: log and keep running rather than let a stray rejection
// (e.g. inside a Socket.io event handler, outside Express's request lifecycle)
// take down every connected teacher/classroom's session.
process.on("unhandledRejection", (err) => console.error("[Unhandled Rejection]", err));
process.on("uncaughtException", (err) => console.error("[Uncaught Exception]", err));

async function main() {
  await initSchema();

  const port = await findAvailablePort(8000);
  const httpsOptions = await getOrCreateHttpsOptions();
  const httpServer = https.createServer(httpsOptions, app);
  setupRealtime(httpServer);

  httpServer.listen(port, "0.0.0.0", async () => {
    await printBanner(port);
    waitForServerReady(port).then(() => openBrowser(`https://localhost:${port}`));
  });
}

main().catch((err) => {
  console.error("[Fatal Startup Error]", err);
  process.exit(1);
});
