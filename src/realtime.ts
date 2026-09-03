// Socket.io replacement for app/ws_manager.py + the /api/system/ws/{course_id}
// endpoint. Each course gets its own room (`course:{id}`); joining requires the
// same session-cookie/token auth as every REST call. Two message shapes:
//   - server -> clients: { event, course_id }                (score/attendance/groups changed)
//   - phone -> server -> other clients: { event: "toolkit_action", action, payload }
//     (remote-control taps relayed to the projection screen, no persistence)
import type { Server as HttpServer } from "http";
import type { Server as HttpsServer } from "https";
import { Server, Socket } from "socket.io";
import { validateSessionToken } from "./middleware/auth";
import { verifyStudentToken } from "./middleware/studentAuth";

let io: Server | undefined;

function courseRoom(courseId: number): string {
  return `course:${courseId}`;
}

export function setupRealtime(httpServer: HttpServer | HttpsServer): Server {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.on("connection", async (socket: Socket) => {
    const token =
      (socket.handshake.query.token as string | undefined) ||
      parseCookieToken(socket.handshake.headers.cookie);

    if (!token) {
      socket.disconnect(true);
      return;
    }

    // 學生 JWT 內建自己的 courseId——一律以此為準，絕不信任前端傳來的 query.course_id，
    // 否則學生能偽造 course_id 加入別班房間偷看即時互動牆等內容。verifyStudentToken 對
    // 教師 token（非 JWT 格式）會乾淨地回傳 null，不影響下面教師驗證路徑的判斷。
    const studentPayload = await verifyStudentToken(token);
    if (studentPayload) {
      socket.join(courseRoom(studentPayload.courseId));
      return; // 學生不需要中繼 toolkit_action，也不該能發送
    }

    // 教師端沿用原本邏輯：共用系統密碼、不分課程，query.course_id 的信任等級與其他
    // REST 呼叫一致（教師本來就能看到自己選的任何課程）。
    const courseId = Number(socket.handshake.query.course_id);
    if (!Number.isInteger(courseId) || !(await validateSessionToken(token))) {
      socket.disconnect(true);
      return;
    }

    socket.join(courseRoom(courseId));

    socket.on("toolkit_action", (data: { action?: string; payload?: unknown }) => {
      if (!data || !data.action) return;
      socket.to(courseRoom(courseId)).emit("server_event", {
        event: "toolkit_action",
        action: data.action,
        payload: data.payload ?? null,
      });
    });
  });

  return io;
}

function parseCookieToken(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("auth_session="));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

/** Broadcasts a named event to every client subscribed to this course's room
 *  (score/attendance/group changes, etc.) — call after every mutating write. */
export function broadcastToCourse(courseId: number, event: string): void {
  io?.to(courseRoom(courseId)).emit("server_event", { event, course_id: courseId });
}
