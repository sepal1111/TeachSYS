import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { prisma } from "../db";
import { getBinDir } from "../paths";
import { parseTextImport } from "../utils/textImport";
import { parseCsvStudents, parseXlsxStudents } from "../utils/fileImport";
import { autoCatch } from "../asyncRoute";
import { defaultStudentAccount, defaultStudentPassword, hashPassword } from "../utils/studentPassword";
import crypto from "crypto";
import { getTodayMMDDTaipei } from "../timezone";

export const coursesRouter = autoCatch(Router());
const photoDir = path.join(getBinDir(), "photo");
const upload = multer({ storage: multer.memoryStorage() });

// login_account is unique system-wide (see prisma schema comment). The deterministic
// default is already collision-free by construction (course_id + student_number is a
// natural key), so a collision only happens if a teacher manually claimed that exact
// string for a different student — rare, handled defensively rather than left to crash.
async function generateUniqueAccount(courseId: number, studentNumber: number): Promise<string> {
  const base = defaultStudentAccount(courseId, studentNumber);
  const existing = await prisma.student.findUnique({ where: { loginAccount: base } });
  if (!existing) return base;
  return `${base}-${crypto.randomBytes(2).toString("hex")}`;
}

/** Uses an explicit account from an import row/payload if given (e.g. the CSV/Excel
 *  template's 帳號 column), otherwise falls back to the deterministic auto-generated one. */
async function resolveImportedAccount(
  explicit: string | null | undefined,
  courseId: number,
  studentNumber: number
): Promise<string> {
  const trimmed = explicit?.trim();
  if (!trimmed) return generateUniqueAccount(courseId, studentNumber);
  const taken = await prisma.student.findUnique({ where: { loginAccount: trimmed } });
  return taken ? generateUniqueAccount(courseId, studentNumber) : trimmed;
}

/** Uses an explicit password from an import row/payload if given (e.g. the CSV/Excel
 *  template's 密碼 column), otherwise falls back to the default (座號四碼). */
function resolveImportedPassword(explicit: string | null | undefined, studentNumber: number): string {
  return explicit?.trim() || defaultStudentPassword(studentNumber);
}

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
  const courseId = Number(req.params.courseId);
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    res.status(404).json({ detail: "找不到該班級，可能已被刪除" });
    return;
  }

  const password = String(req.body?.password ?? req.query?.password ?? "");
  const settingRow = await prisma.systemSetting.findUnique({ where: { key: "password_prefix" } });
  const prefix = settingRow?.value || "Admin";
  const todayMmdd = getTodayMMDDTaipei();
  const expected = `${prefix}${todayMmdd}`;

  if (!password || password.trim() !== expected) {
    res.status(400).json({ detail: "系統密碼錯誤，無法刪除班級！" });
    return;
  }

  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");
  await prisma.course.delete({ where: { id: courseId } });
  res.json({ success: true, message: `班級「${course.name}」已成功刪除！` });
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
    students.map((s) => ({
      id: s.id,
      student_number: s.studentNumber,
      student_code: s.studentCode,
      login_account: s.loginAccount,
      name: s.name,
      english_name: s.englishName,
      gender: s.gender,
      group_id: s.groupId,
      group_name: s.group?.groupName ?? null,
      seat_row: s.seatRow,
      seat_col: s.seatCol,
      has_photo: Boolean(s.studentCode && fs.existsSync(path.join(photoDir, `${s.studentCode}.jpg`))),
    }))
  );
});

coursesRouter.post("/:courseId/students", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { student_number, name, english_name = null, gender = "M", group_id = null, student_code = null, login_account = null, password = null } =
    req.body ?? {};

  const loginAccount: string = (login_account as string | null)?.trim() || "";
  if (!loginAccount) {
    res.status(400).json({ detail: "請輸入學生登入帳號" });
    return;
  }
  const taken = await prisma.student.findUnique({ where: { loginAccount } });
  if (taken) {
    res.status(400).json({ detail: "此帳號已被使用，請換一個" });
    return;
  }

  const student = await prisma.student.create({
    data: {
      courseId,
      studentNumber: student_number,
      name,
      englishName: english_name,
      gender,
      groupId: group_id,
      studentCode: student_code,
      loginAccount,
      passwordHash: hashPassword((password as string | null)?.trim() || defaultStudentPassword(student_number)),
    },
  });
  res.json({ id: student.id, login_account: loginAccount, message: "Student created" });
});

coursesRouter.post("/:courseId/students/batch", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const students: Array<{
    student_number: number;
    name: string;
    english_name?: string | null;
    gender?: string | null;
    student_code?: string | null;
    login_account?: string | null;
    password?: string | null;
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
        loginAccount: await resolveImportedAccount(item.login_account, courseId, item.student_number),
        passwordHash: hashPassword(resolveImportedPassword(item.password, item.student_number)),
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
        loginAccount: await resolveImportedAccount(s.login_account, courseId, s.student_number),
        passwordHash: hashPassword(resolveImportedPassword(s.password, s.student_number)),
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
        loginAccount: await resolveImportedAccount(s.login_account, courseId, s.student_number),
        passwordHash: hashPassword(resolveImportedPassword(s.password, s.student_number)),
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
  const { student_number, student_code, name, english_name, gender, login_account } = req.body ?? {};

  let loginAccount = student.loginAccount;
  if (typeof login_account === "string") {
    const trimmed = login_account.trim();
    if (!trimmed) {
      res.status(400).json({ detail: "帳號不可留空" });
      return;
    }
    if (trimmed !== student.loginAccount) {
      const taken = await prisma.student.findUnique({ where: { loginAccount: trimmed } });
      if (taken) {
        res.status(400).json({ detail: "此帳號已被使用，請換一個" });
        return;
      }
      loginAccount = trimmed;
    }
  }

  await prisma.student.update({
    where: { id: studentId },
    data: {
      studentNumber: student_number ?? student.studentNumber,
      studentCode: student_code ?? student.studentCode,
      name: name ?? student.name,
      englishName: english_name ?? student.englishName,
      gender: gender ?? student.gender,
      loginAccount,
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

// --- 範本檔案下載 ---

const TEMPLATE_HEADERS = [
  "座號",
  "學號",
  "中文姓名",
  "英文姓名",
  "性別",
  "帳號 (可選，留空由系統自動產生)",
  "密碼 (可選，留空預設為座號四碼)",
];
const TEMPLATE_SAMPLE: (string | number)[][] = [
  [1, "112001", "王小明", "David", "男", "", ""],
  [2, "112002", "李小華", "Emily", "女", "", ""],
  [3, "112003", "張大同", "Tom", "男", "", ""],
  [4, "112004", "陳雅婷", "Grace", "女", "", ""],
  [5, "112005", "林志豪", "Leo", "男", "", ""],
];

coursesRouter.get("/template/students_excel", async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("學生名冊匯入範例");
  ws.addRow(TEMPLATE_HEADERS);
  for (const row of [
    ...TEMPLATE_SAMPLE,
    [6, "112006", "黃美玲", "May", "女", "", ""],
    [7, "112007", "趙子龍", "Alex", "男", "", ""],
    [8, "112008", "周雅玲", "Chloe", "女", "", ""],
    [9, "112009", "孫悟空", "Sam", "男", "", ""],
    [10, "112010", "吳小雯", "Wendy", "女", "", ""],
  ]) {
    ws.addRow(row);
  }

  ws.columns = [{ width: 12 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 30 }, { width: 30 }];
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
