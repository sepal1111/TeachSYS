// Port of app/routers/system.py's session helpers. The Phase-1 migration keeps
// the existing single shared "password prefix + today's MMDD" scheme as-is
// (teachers' daily workflow must not change); per-user teacher/student accounts
// are a Phase-2 (LMS) addition layered on top, not a replacement.
import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { getNowStrTaipei, getTodayStrTaipei } from "../timezone";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day, same as the Python version's max_age=86400

function addMs(dateStr: string, ms: number): string {
  // dateStr is "YYYY-MM-DD HH:MM:SS" in Taipei wall-clock time; do the arithmetic
  // in a timezone-naive way (treat it as UTC) so the stored string stays comparable
  // to future getNowStrTaipei() output via plain string comparison.
  const asUtc = new Date(dateStr.replace(" ", "T") + "Z");
  const shifted = new Date(asUtc.getTime() + ms);
  return shifted.toISOString().slice(0, 19).replace("T", " ");
}

export async function createSession(): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const todayStr = getTodayStrTaipei();
  const nowStr = getNowStrTaipei();
  const expiresAt = addMs(nowStr, SESSION_TTL_MS);

  await prisma.systemSession.deleteMany({
    where: { OR: [{ expiresAt: { lt: nowStr } }, { createdDate: { not: todayStr } }] },
  });

  await prisma.systemSession.create({
    data: { token, createdDate: todayStr, expiresAt, createdAt: nowStr },
  });
  return token;
}

export async function validateSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const todayStr = getTodayStrTaipei();
  const nowStr = getNowStrTaipei();
  const row = await prisma.systemSession.findFirst({
    where: { token, createdDate: todayStr, expiresAt: { gte: nowStr } },
  });
  return Boolean(row);
}

export function getCurrentSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const xToken = req.headers["x-auth-token"];
  if (typeof xToken === "string" && xToken) {
    return xToken.trim();
  }
  const cookieToken = req.cookies?.auth_session;
  if (cookieToken) {
    return String(cookieToken).trim();
  }
  return undefined;
}

export async function isRequestAuthenticated(req: Request): Promise<boolean> {
  return validateSessionToken(getCurrentSessionToken(req));
}

/** Express middleware that mirrors the FastAPI `require_auth` dependency. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getCurrentSessionToken(req);
  if (!(await validateSessionToken(token))) {
    res.status(401).json({ detail: "未登入或身分驗證已逾期，請先登入系統！" });
    return;
  }
  next();
}
