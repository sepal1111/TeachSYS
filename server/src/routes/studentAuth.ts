// Student-facing login endpoints — public (no teacher session required), the
// counterpart to the account-management endpoints in routes/courses.ts.
// Two ways in, per node_migration_and_lms_plan.md section 3:
//   1. Password login (座號 + 密碼) — works from anywhere, any time.
//   2. Classroom QR join (join token) — teacher displays a QR for the current
//      class period; scanning it proves "physically in the room right now",
//      so the student just picks their own name from the roster, no password.
import { Router } from "express";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { verifyPassword } from "../utils/studentPassword";
import { requireStudentAuth, signStudentToken } from "../middleware/studentAuth";

export const studentAuthRouter = autoCatch(Router());

// Public course picker for the login page — names only, no roster/scores, low
// enough sensitivity to expose without auth (mirrors the teacher tool's own
// no-login system/QR info endpoints).
studentAuthRouter.get("/courses", async (_req, res) => {
  const courses = await prisma.course.findMany({ orderBy: { id: "desc" }, select: { id: true, name: true } });
  res.json(courses);
});

studentAuthRouter.post("/login", async (req, res) => {
  const courseId = Number(req.body?.course_id);
  const studentNumber = Number(req.body?.student_number);
  const password: string = req.body?.password ?? "";

  const student = await prisma.student.findFirst({
    where: { courseId, studentNumber, isActive: 1 },
  });
  if (!student || !verifyPassword(password, student.passwordHash)) {
    res.status(401).json({ detail: "座號或密碼錯誤，請確認後再試一次！" });
    return;
  }

  const token = await signStudentToken({ studentId: student.id, courseId });
  res.json({
    token,
    student: { id: student.id, student_number: student.studentNumber, name: student.name, course_id: courseId },
  });
});

function isJoinTokenValid(course: { joinToken: string | null; joinTokenExpiresAt: string | null }, token: string): boolean {
  if (!course.joinToken || course.joinToken !== token) return false;
  if (!course.joinTokenExpiresAt) return false;
  return new Date(course.joinTokenExpiresAt).getTime() > Date.now();
}

studentAuthRouter.post("/join", async (req, res) => {
  const courseId = Number(req.body?.course_id);
  const joinToken: string = req.body?.join_token ?? "";

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !isJoinTokenValid(course, joinToken)) {
    res.status(401).json({ detail: "此課堂 QR Code 已失效，請請老師重新開啟！" });
    return;
  }

  const roster = await prisma.student.findMany({
    where: { courseId, isActive: 1 },
    orderBy: { studentNumber: "asc" },
    select: { id: true, studentNumber: true, name: true, englishName: true, gender: true },
  });
  res.json({ course: { id: course.id, name: course.name }, roster });
});

studentAuthRouter.post("/join/select", async (req, res) => {
  const courseId = Number(req.body?.course_id);
  const joinToken: string = req.body?.join_token ?? "";
  const studentId = Number(req.body?.student_id);

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !isJoinTokenValid(course, joinToken)) {
    res.status(401).json({ detail: "此課堂 QR Code 已失效，請請老師重新開啟！" });
    return;
  }

  const student = await prisma.student.findFirst({ where: { id: studentId, courseId, isActive: 1 } });
  if (!student) {
    res.status(404).json({ detail: "找不到這位學生，請確認後再試一次！" });
    return;
  }

  const token = await signStudentToken({ studentId: student.id, courseId });
  res.json({
    token,
    student: { id: student.id, student_number: student.studentNumber, name: student.name, course_id: courseId },
  });
});

studentAuthRouter.get("/me", requireStudentAuth, async (req, res) => {
  const { studentId, courseId } = req.studentAuth!;
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!student || !course) {
    res.status(404).json({ detail: "Student or course not found" });
    return;
  }
  res.json({
    student: {
      id: student.id,
      student_number: student.studentNumber,
      name: student.name,
      english_name: student.englishName,
      gender: student.gender,
    },
    course: { id: course.id, name: course.name },
  });
});
