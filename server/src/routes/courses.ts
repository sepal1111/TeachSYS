// Port of app/routers/courses.py
import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { prisma } from "../db";
import { parseTextImport } from "../utils/textImport";
import { parseCsvStudents, parseXlsxStudents } from "../utils/fileImport";
import { autoCatch } from "../asyncRoute";
import { defaultStudentPassword, hashPassword } from "../utils/studentPassword";
import { getLocalIp } from "../utils/network";
import QRCode from "qrcode";
import crypto from "crypto";

export const coursesRouter = autoCatch(Router());
const upload = multer({ storage: multer.memoryStorage() });

const DEFAULT_RULES = [
  { title: "熱心助人", category: "positive", score_value: 1, icon: "🤝" },
  { title: "發言踴躍", category: "positive", score_value: 1, icon: "🙋‍♂️" },
  { title: "專心聽講", category: "positive", score_value: 1, icon: "👂" },
  { title: "作業優良", category: "positive", score_value: 2, icon: "📝" },
  { title: "團隊合作", category: "positive", score_value: 1, icon: "🌟" },
  { title: "上課吵鬧", category: "negative", score_value: -1, icon: "📢" },
  { title: "未帶用品", category: "negative", score_value: -1, icon: "🎒" },
  { title: "上課分心", category: "negative", score_value: -1, icon: "😴" },
];

coursesRouter.get("", async (_req, res) => {
  const courses = await prisma.course.findMany({ orderBy: { id: "desc" } });
  const withCounts = await Promise.all(
    courses.map(async (c) => ({
      ...c,
      student_count: await prisma.student.count({ where: { courseId: c.id, isActive: 1 } }),
    }))
  );
  res.json(withCounts);
});

coursesRouter.post("", async (req, res) => {
  const { name, teacher_type = "homeroom", description = null } = req.body ?? {};
  const course = await prisma.course.create({ data: { name, teacherType: teacher_type, description } });
  await prisma.evaluationRule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      courseId: course.id,
      title: r.title,
      category: r.category,
      scoreValue: r.score_value,
      icon: r.icon,
      isDefault: 1,
    })),
  });
  res.json({ id: course.id, message: "Course created with default evaluation rules" });
});

coursesRouter.get("/:courseId", async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: Number(req.params.courseId) } });
  if (!course) {
    res.status(404).json({ detail: "Course not found" });
    return;
  }
  res.json(course);
});

coursesRouter.delete("/:courseId", async (req, res) => {
  await prisma.course.delete({ where: { id: Number(req.params.courseId) } }).catch(() => undefined);
  res.json({ message: "Course deleted successfully" });
});

// --- Evaluation Rules ---

coursesRouter.get("/:courseId/rules", async (req, res) => {
  const rules = await prisma.evaluationRule.findMany({
    where: { courseId: Number(req.params.courseId) },
    orderBy: [{ category: "desc" }, { id: "asc" }],
  });
  res.json(rules);
});

coursesRouter.post("/:courseId/rules", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { title, category = "positive", score_value, icon = "⭐" } = req.body ?? {};
  const rule = await prisma.evaluationRule.create({
    data: { courseId, title, category, scoreValue: score_value, icon },
  });
  res.json({ id: rule.id, message: "Rule created" });
});

coursesRouter.put("/:courseId/rules/:ruleId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const ruleId = Number(req.params.ruleId);
  const { title, category, score_value, icon } = req.body ?? {};
  await prisma.evaluationRule.updateMany({
    where: { id: ruleId, courseId },
    data: { title, category, scoreValue: score_value, icon },
  });
  res.json({ message: "Rule updated" });
});

coursesRouter.delete("/:courseId/rules/:ruleId", async (req, res) => {
  await prisma.evaluationRule.deleteMany({
    where: { id: Number(req.params.ruleId), courseId: Number(req.params.courseId) },
  });
  res.json({ message: "Rule deleted" });
});

coursesRouter.post("/:courseId/rules/reset_defaults", async (req, res) => {
  const courseId = Number(req.params.courseId);
  await prisma.evaluationRule.deleteMany({ where: { courseId } });
  await prisma.evaluationRule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      courseId,
      title: r.title,
      category: r.category,
      scoreValue: r.score_value,
      icon: r.icon,
    })),
  });
  res.json({ message: "Default rules restored" });
});

// --- 學生管理 ---

coursesRouter.get("/:courseId/students", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const students = await prisma.student.findMany({
    where: { courseId, isActive: 1 },
    orderBy: { studentNumber: "asc" },
    include: { group: { select: { groupName: true } } },
  });
  res.json(
    students.map((s) => {
      const { group, ...rest } = s;
      return { ...rest, group_name: group?.groupName ?? null };
    })
  );
});

coursesRouter.post("/:courseId/students", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { student_number, name, english_name = null, gender = "M", group_id = null, student_code = null } =
    req.body ?? {};
  const student = await prisma.student.create({
    data: {
      courseId,
      studentNumber: student_number,
      name,
      englishName: english_name,
      gender,
      groupId: group_id,
      studentCode: student_code,
      passwordHash: hashPassword(defaultStudentPassword(student_number)),
    },
  });
  res.json({ id: student.id, message: "Student created" });
});

coursesRouter.post("/:courseId/students/batch", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const students: Array<{
    student_number: number;
    name: string;
    english_name?: string | null;
    gender?: string | null;
    student_code?: string | null;
  }> = req.body?.students ?? [];

  let count = 0;
  for (const item of students) {
    let gender = (item.gender || "M").toUpperCase();
    if (gender !== "M" && gender !== "F") gender = "M";
    await prisma.student.create({
      data: {
        courseId,
        studentNumber: item.student_number,
        name: item.name,
        englishName: item.english_name ?? null,
        gender,
        studentCode: item.student_code ?? null,
        passwordHash: hashPassword(defaultStudentPassword(item.student_number)),
      },
    });
    count++;
  }
  res.json({ imported_count: count, message: `Successfully imported ${count} students` });
});

coursesRouter.post("/:courseId/students/text_import", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const textContent: string = req.body?.text_content ?? "";
  const parsed = parseTextImport(textContent);

  let count = 0;
  for (const s of parsed) {
    await prisma.student.create({
      data: {
        courseId,
        studentNumber: s.student_number,
        studentCode: s.student_code,
        name: s.name,
        englishName: s.english_name,
        gender: s.gender,
        passwordHash: hashPassword(defaultStudentPassword(s.student_number)),
      },
    });
    count++;
  }
  res.json({ imported_count: count, message: `Successfully imported ${count} students` });
});

coursesRouter.post("/:courseId/students/upload", upload.single("file"), async (req, res) => {
  const courseId = Number(req.params.courseId);
  const file = req.file;
  if (!file) {
    res.status(400).json({ detail: "Only .csv and .xlsx/.xls files are supported" });
    return;
  }
  const filename = file.originalname.toLowerCase();

  let parsed;
  if (filename.endsWith(".csv")) {
    parsed = parseCsvStudents(file.buffer.toString("utf-8"));
  } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    parsed = await parseXlsxStudents(file.buffer);
  } else {
    res.status(400).json({ detail: "Only .csv and .xlsx/.xls files are supported" });
    return;
  }

  let count = 0;
  for (const s of parsed) {
    await prisma.student.create({
      data: {
        courseId,
        studentNumber: s.student_number,
        studentCode: s.student_code,
        name: s.name,
        englishName: s.english_name,
        gender: s.gender,
        passwordHash: hashPassword(defaultStudentPassword(s.student_number)),
      },
    });
    count++;
  }
  res.json({ imported_count: count, message: `Successfully imported ${count} students` });
});

coursesRouter.put("/:courseId/students/:studentId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const studentId = Number(req.params.studentId);
  const student = await prisma.student.findFirst({ where: { id: studentId, courseId } });
  if (!student) {
    res.status(404).json({ detail: "Student not found" });
    return;
  }
  const { student_number, student_code, name, english_name, gender } = req.body ?? {};
  await prisma.student.update({
    where: { id: studentId },
    data: {
      studentNumber: student_number ?? student.studentNumber,
      studentCode: student_code ?? student.studentCode,
      name: name ?? student.name,
      englishName: english_name ?? student.englishName,
      gender: gender ?? student.gender,
    },
  });
  res.json({ message: "Student updated successfully" });
});

coursesRouter.delete("/:courseId/students/:studentId", async (req, res) => {
  await prisma.student.deleteMany({
    where: { id: Number(req.params.studentId), courseId: Number(req.params.courseId) },
  });
  res.json({ message: "Student deleted" });
});

// --- LMS 學生登入帳密管理（教師端；學生本人登入見 src/routes/studentAuth.ts）---

coursesRouter.put("/:courseId/students/:studentId/password", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const studentId = Number(req.params.studentId);
  const student = await prisma.student.findFirst({ where: { id: studentId, courseId } });
  if (!student) {
    res.status(404).json({ detail: "Student not found" });
    return;
  }

  const customPassword: string | undefined = req.body?.password;
  const effectivePassword = customPassword?.trim() ? customPassword.trim() : defaultStudentPassword(student.studentNumber);

  await prisma.student.update({ where: { id: studentId }, data: { passwordHash: hashPassword(effectivePassword) } });
  res.json({
    message: customPassword ? "密碼已更新" : "密碼已重設為預設值（座號四碼）",
    password: effectivePassword,
  });
});

coursesRouter.post("/:courseId/students/passwords/reset_all", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const students = await prisma.student.findMany({ where: { courseId, isActive: 1 } });
  for (const s of students) {
    await prisma.student.update({
      where: { id: s.id },
      data: { passwordHash: hashPassword(defaultStudentPassword(s.studentNumber)) },
    });
  }
  res.json({ message: `已將 ${students.length} 位學生的密碼重設為預設值（座號四碼）`, count: students.length });
});

// --- LMS 課堂 QR Code 免密碼登入（教師開課時產生短效期 join token）---

coursesRouter.post("/:courseId/join_qr", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    res.status(404).json({ detail: "Course not found" });
    return;
  }

  const joinToken = crypto.randomBytes(16).toString("hex");
  const expiresInMs = 4 * 60 * 60 * 1000; // 4 hours — long enough for one school day's classes.
  const joinTokenExpiresAt = new Date(Date.now() + expiresInMs).toISOString();
  await prisma.course.update({ where: { id: courseId }, data: { joinToken, joinTokenExpiresAt } });

  // Always encode the LAN IP (not req.hostname) so the QR works from a
  // student's phone even when the teacher's own browser is on localhost.
  const port = req.socket.localPort;
  const host = getLocalIp();
  const joinUrl = `http://${host}${port ? `:${port}` : ""}/student?course_id=${courseId}&join=${joinToken}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, { errorCorrectionLevel: "L", margin: 2, scale: 8 });

  res.json({ join_token: joinToken, expires_at: joinTokenExpiresAt, join_url: joinUrl, qr_code: qrDataUrl });
});

// --- 範本檔案下載 ---

const TEMPLATE_HEADERS = ["座號", "學號", "中文姓名", "英文姓名", "性別"];
const TEMPLATE_SAMPLE: (string | number)[][] = [
  [1, "112001", "王小明", "David", "男"],
  [2, "112002", "李小華", "Emily", "女"],
  [3, "112003", "張大同", "Tom", "男"],
  [4, "112004", "陳雅婷", "Grace", "女"],
  [5, "112005", "林志豪", "Leo", "男"],
];

coursesRouter.get("/template/students_excel", async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("學生名冊匯入範例");
  ws.addRow(TEMPLATE_HEADERS);
  for (const row of [
    ...TEMPLATE_SAMPLE,
    [6, "112006", "黃美玲", "May", "女"],
    [7, "112007", "趙子龍", "Alex", "男"],
    [8, "112008", "周雅玲", "Chloe", "女"],
    [9, "112009", "孫悟空", "Sam", "男"],
    [10, "112010", "吳小雯", "Wendy", "女"],
  ]) {
    ws.addRow(row);
  }

  ws.columns = [{ width: 12 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 12 }];
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.font = { name: "Microsoft JhengHei", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  for (let r = 2; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell((cell) => {
      cell.font = { name: "Microsoft JhengHei", size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = encodeURIComponent("學生名冊匯入範例.xlsx");
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
  });
  res.send(Buffer.from(buffer));
});

coursesRouter.get("/template/students_csv", (_req, res) => {
  const lines = [TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE].map((row) => row.join(","));
  const content = "﻿" + lines.join("\r\n") + "\r\n";
  const filename = encodeURIComponent("學生名冊匯入範例.csv");
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
  });
  res.send(Buffer.from(content, "utf-8"));
});
