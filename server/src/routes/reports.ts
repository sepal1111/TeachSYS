// Port of app/routers/reports.py
import ExcelJS from "exceljs";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getTodayStrTaipei, getTodayTaipei } from "../timezone";

export const reportsRouter = Router();

function isoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

reportsRouter.get("/:courseId/dashboard", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const period = (req.query.period as string) ?? "today";
  const planIdParam = req.query.plan_id ? Number(req.query.plan_id) : undefined;
  let startDate = req.query.start_date as string | undefined;
  let endDate = req.query.end_date as string | undefined;

  const today = getTodayTaipei();
  const todayStr = isoDate(today.year, today.month, today.day);

  if (period === "today") {
    startDate = todayStr;
    endDate = todayStr;
  } else if (period === "week") {
    const mondayOffset = today.weekday; // Monday=0
    const mondayUtc = new Date(Date.UTC(today.year, today.month - 1, today.day - mondayOffset));
    const sundayUtc = new Date(mondayUtc.getTime() + 6 * 86400000);
    startDate = mondayUtc.toISOString().slice(0, 10);
    endDate = sundayUtc.toISOString().slice(0, 10);
  } else if (period === "month") {
    const lastDay = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
    startDate = isoDate(today.year, today.month, 1);
    endDate = isoDate(today.year, today.month, lastDay);
  } else if (period === "semester") {
    startDate = undefined;
    endDate = undefined;
  }

  let activePlan = planIdParam
    ? await prisma.groupPlan.findFirst({ where: { id: planIdParam, courseId } })
    : await prisma.groupPlan.findFirst({ where: { courseId, isActive: 1 } });
  if (!activePlan) {
    activePlan = await prisma.groupPlan.findFirst({ where: { courseId }, orderBy: { id: "asc" } });
  }
  const planIdVal = activePlan?.id ?? null;

  const students = await prisma.student.findMany({
    where: { courseId, isActive: 1 },
    orderBy: { studentNumber: "asc" },
    include: {
      groupMemberships: { where: { planId: planIdVal ?? -1 }, include: { group: true } },
      group: true,
    },
  });

  const todayAttendance = await prisma.attendance.findMany({ where: { courseId, date: todayStr } });
  const attendanceMap = new Map(todayAttendance.map((a) => [a.studentId, a.status]));

  const rangeIsEmpty = period === "range" && !startDate && !endDate;

  const scoreWhere: Prisma.ScoreLogWhereInput = { courseId, isUndone: 0 };
  if (rangeIsEmpty) {
    scoreWhere.id = -1; // matches Python's "AND 1 = 0" — no rows.
  } else {
    if (startDate) scoreWhere.date = { ...(scoreWhere.date as object), gte: startDate };
    if (endDate) scoreWhere.date = { ...(scoreWhere.date as object), lte: endDate };
  }
  const scoreSums = rangeIsEmpty
    ? []
    : await prisma.scoreLog.groupBy({ by: ["studentId"], where: scoreWhere, _sum: { score: true } });
  const scoreMap = new Map(scoreSums.map((s) => [s.studentId, s._sum.score ?? 0]));

  // Group award events: dedupe identical (group_id, timestamp, rule_title, score) rows
  // before summing, so a group-wide award counts once rather than once per member.
  let groupAwardMap = new Map<number, number>();
  if (!rangeIsEmpty) {
    const rows = await prisma.$queryRaw<{ group_id: number; group_score: number }[]>(
      Prisma.sql`
        SELECT group_id, SUM(event_score) AS group_score FROM (
          SELECT sl.group_id AS group_id, sl.timestamp, sl.rule_title, sl.score AS event_score
          FROM score_logs sl
          LEFT JOIN groups g ON sl.group_id = g.id
          WHERE sl.course_id = ${courseId} AND sl.is_undone = 0 AND sl.group_id IS NOT NULL
            ${planIdVal != null ? Prisma.sql`AND (sl.plan_id = ${planIdVal} OR (sl.plan_id IS NULL AND (g.plan_id = ${planIdVal} OR g.plan_id IS NULL)))` : Prisma.empty}
            ${startDate ? Prisma.sql`AND sl.date >= ${startDate}` : Prisma.empty}
            ${endDate ? Prisma.sql`AND sl.date <= ${endDate}` : Prisma.empty}
          GROUP BY sl.group_id, sl.timestamp, sl.rule_title, sl.score
        )
        GROUP BY group_id
      `
    );
    groupAwardMap = new Map(rows.map((r) => [r.group_id, r.group_score]));
  }

  const planGroups = planIdVal
    ? await prisma.group.findMany({ where: { courseId, planId: planIdVal }, orderBy: [{ orderIndex: "asc" }, { id: "asc" }] })
    : await prisma.group.findMany({ where: { courseId }, orderBy: [{ orderIndex: "asc" }, { id: "asc" }] });

  const memberCountMap = new Map<number, number>();
  const studentsOut = students.map((s) => {
    const groupId = planIdVal ? s.groupMemberships[0]?.groupId ?? null : (s as unknown as { groupId: number | null }).groupId;
    const groupName = planIdVal ? s.groupMemberships[0]?.group.groupName ?? null : (s as unknown as { group?: { groupName: string } }).group?.groupName ?? null;
    if (groupId) memberCountMap.set(groupId, (memberCountMap.get(groupId) ?? 0) + 1);

    const status = attendanceMap.get(s.id) ?? "present";
    return {
      id: s.id,
      student_number: s.studentNumber,
      student_code: s.studentCode,
      name: s.name,
      english_name: s.englishName,
      gender: s.gender,
      group_id: groupId,
      group_name: groupName,
      score: scoreMap.get(s.id) ?? 0,
      today_attendance: status,
      is_absent: ["absent", "sick_leave", "personal_leave", "official_leave", "bereavement_leave"].includes(status),
    };
  });

  const groupScores = planGroups.map((g) => {
    const totalPts = groupAwardMap.get(g.id) ?? 0;
    return {
      id: g.id,
      group_name: g.groupName,
      icon_url: g.iconUrl,
      total_score: totalPts,
      member_count: memberCountMap.get(g.id) ?? 0,
      avg_score: totalPts,
    };
  });

  const individualLeaderboard = studentsOut
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const groupLeaderboard = groupScores.filter((g) => g.total_score > 0).sort((a, b) => b.total_score - a.total_score);

  res.json({
    period,
    plan: activePlan,
    start_date: startDate ?? null,
    end_date: endDate ?? null,
    students: studentsOut,
    individual_leaderboard: individualLeaderboard,
    group_leaderboard: groupLeaderboard,
  });
});

reportsRouter.get("/:courseId/export", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    res.status(404).json({ detail: "Course not found" });
    return;
  }

  const wb = new ExcelJS.Workbook();
  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
  const headerFont: Partial<ExcelJS.Font> = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  const titleFont: Partial<ExcelJS.Font> = { name: "Arial", size: 14, bold: true };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };

  const students = await prisma.student.findMany({ where: { courseId, isActive: 1 }, orderBy: { studentNumber: "asc" } });

  // --- Sheet 1: 出缺席統計 ---
  const wsAtt = wb.addWorksheet("出缺席統計");
  wsAtt.addRow([`課程：${course.name} - 出缺席統計報表`, `區間：${startDate || "不限"} ~ ${endDate || "不限"}`]);
  wsAtt.addRow([]);
  wsAtt.addRow(["座號", "姓名", "性別", "出席次數", "病假次數", "事假次數", "公假次數", "喪假次數", "遲到次數"]);

  for (const s of students) {
    const where: Prisma.AttendanceWhereInput = { studentId: s.id };
    if (startDate) where.date = { ...(where.date as object), gte: startDate };
    if (endDate) where.date = { ...(where.date as object), lte: endDate };
    const counts = await prisma.attendance.groupBy({ by: ["status"], where, _count: { status: true } });
    const countMap = new Map(counts.map((c) => [c.status, c._count.status]));

    wsAtt.addRow([
      s.studentNumber,
      s.name,
      s.gender === "M" ? "男" : "女",
      countMap.get("present") ?? 0,
      (countMap.get("sick_leave") ?? 0) + (countMap.get("absent") ?? 0),
      countMap.get("personal_leave") ?? 0,
      countMap.get("official_leave") ?? 0,
      countMap.get("bereavement_leave") ?? 0,
      countMap.get("late") ?? 0,
    ]);
  }

  // --- Sheet 2: 量化成績計分表 ---
  const wsScore = wb.addWorksheet("量化成績統計與明細");
  wsScore.addRow([`課程：${course.name} - 量化成績總計與評分明細`]);
  wsScore.addRow([]);
  wsScore.addRow(["座號", "姓名", "加減分總計"]);

  for (const s of students) {
    const sumWhere: Prisma.ScoreLogWhereInput = { studentId: s.id, isUndone: 0 };
    if (startDate) sumWhere.date = { ...(sumWhere.date as object), gte: startDate };
    if (endDate) sumWhere.date = { ...(sumWhere.date as object), lte: endDate };
    const agg = await prisma.scoreLog.aggregate({ where: sumWhere, _sum: { score: true } });
    wsScore.addRow([s.studentNumber, s.name, agg._sum.score ?? 0]);
  }

  wsScore.addRow([]);
  wsScore.addRow(["--- 評分細項明細 ---"]);
  wsScore.addRow(["日期時間", "座號", "學生姓名", "評分項目", "分數", "類別", "所屬分組模式", "所屬小組"]);

  const logWhere: Prisma.ScoreLogWhereInput = { courseId, isUndone: 0 };
  if (startDate) logWhere.date = { ...(logWhere.date as object), gte: startDate };
  if (endDate) logWhere.date = { ...(logWhere.date as object), lte: endDate };
  const logs = await prisma.scoreLog.findMany({
    where: logWhere,
    orderBy: { timestamp: "desc" },
    include: { student: true },
  });
  const planIds = [...new Set(logs.map((l) => l.planId).filter((v): v is number => v != null))];
  const groupIds = [...new Set(logs.map((l) => l.groupId).filter((v): v is number => v != null))];
  const planMap = new Map((await prisma.groupPlan.findMany({ where: { id: { in: planIds } } })).map((p) => [p.id, p.name]));
  const groupMap = new Map((await prisma.group.findMany({ where: { id: { in: groupIds } } })).map((g) => [g.id, g.groupName]));

  for (const log of logs) {
    wsScore.addRow([
      log.timestamp,
      log.student.studentNumber,
      log.student.name,
      log.ruleTitle,
      log.score,
      log.category === "positive" ? "正向" : "負向",
      (log.planId != null ? planMap.get(log.planId) : null) || "個人評分",
      (log.groupId != null ? groupMap.get(log.groupId) : null) || "-",
    ]);
  }

  // --- Sheet 3: 小組分數成員與得分一覽 ---
  const wsGroups = wb.addWorksheet("小組分數成員與得分一覽");
  wsGroups.addRow([`課程：${course.name} - 小組分組名單、獨立總得分與成員一覽`, `區間：${startDate || "不限"} ~ ${endDate || "不限"}`]);
  wsGroups.addRow([]);

  const plans = await prisma.groupPlan.findMany({ where: { courseId }, orderBy: { id: "asc" } });
  const pastelColors = ["EFF6FF", "ECFDF5", "FFFBEB", "FAF5FF", "FFF1F2", "F0FDFA", "FFF7ED", "F5F3FF"];

  type GroupRow = { planIdx: number; planName: string; groupName: string; groupScore: number | string; memberCount: number; members: string[] };
  const allGroupData: GroupRow[] = [];
  let maxMembers = 1;

  for (let planIdx = 0; planIdx < plans.length; planIdx++) {
    const p = plans[planIdx];
    const pGroups = await prisma.group.findMany({ where: { courseId, planId: p.id }, orderBy: [{ orderIndex: "asc" }, { id: "asc" }] });

    const pGroupRows = await prisma.$queryRaw<{ group_id: number; group_score: number }[]>(
      Prisma.sql`
        SELECT group_id, SUM(event_score) AS group_score FROM (
          SELECT sl.group_id AS group_id, sl.timestamp, sl.rule_title, sl.score AS event_score
          FROM score_logs sl
          LEFT JOIN groups g ON sl.group_id = g.id
          WHERE sl.course_id = ${courseId} AND sl.is_undone = 0 AND sl.group_id IS NOT NULL
            AND (sl.plan_id = ${p.id} OR (sl.plan_id IS NULL AND (g.plan_id = ${p.id} OR g.plan_id IS NULL)))
            ${startDate ? Prisma.sql`AND sl.date >= ${startDate}` : Prisma.empty}
            ${endDate ? Prisma.sql`AND sl.date <= ${endDate}` : Prisma.empty}
          GROUP BY sl.group_id, sl.timestamp, sl.rule_title, sl.score
        )
        GROUP BY group_id
      `
    );
    const pGroupScoreMap = new Map(pGroupRows.map((r) => [r.group_id, r.group_score]));

    for (const g of pGroups) {
      const members = await prisma.groupMember.findMany({
        where: { planId: p.id, groupId: g.id, student: { isActive: 1 } },
        include: { student: true },
        orderBy: { student: { studentNumber: "asc" } },
      });
      maxMembers = Math.max(maxMembers, members.length);
      allGroupData.push({
        planIdx,
        planName: p.name,
        groupName: g.groupName,
        groupScore: pGroupScoreMap.get(g.id) ?? 0,
        memberCount: members.length,
        members: members.map((m) => `${m.student.studentNumber}號 ${m.student.name}`),
      });
    }

    const assignedIds = new Set((await prisma.groupMember.findMany({ where: { planId: p.id } })).map((m) => m.studentId));
    const unassignedMembers = (await prisma.student.findMany({ where: { courseId, isActive: 1 }, orderBy: { studentNumber: "asc" } })).filter(
      (s) => !assignedIds.has(s.id)
    );
    if (unassignedMembers.length) {
      maxMembers = Math.max(maxMembers, unassignedMembers.length);
      allGroupData.push({
        planIdx,
        planName: p.name,
        groupName: "未分組",
        groupScore: "-",
        memberCount: unassignedMembers.length,
        members: unassignedMembers.map((m) => `${m.studentNumber}號 ${m.name}`),
      });
    }
  }

  wsGroups.addRow(["分組模式", "小組名稱", "小組獨立得分", "組內成員人數", ...Array.from({ length: maxMembers }, (_, i) => `成員 ${i + 1}`)]);
  for (const item of allGroupData) {
    const row = wsGroups.addRow([item.planName, item.groupName, item.groupScore, item.memberCount, ...item.members]);
    const fill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${pastelColors[item.planIdx % pastelColors.length]}` } };
    row.eachCell((cell, colNumber) => {
      cell.fill = fill;
      cell.border = thinBorder;
      if ([1, 2, 3, 4].includes(colNumber)) cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  }

  // --- Sheet 4: 質性紀錄明細 ---
  const wsNotes = wb.addWorksheet("質性紀錄明細");
  wsNotes.addRow([`課程：${course.name} - 特殊表現與質性紀錄明細`]);
  wsNotes.addRow([]);
  wsNotes.addRow(["日期時間", "座號", "學生姓名", "紀錄內容"]);

  const notesWhere: Prisma.QualitativeNoteWhereInput = { courseId };
  if (startDate) notesWhere.date = { ...(notesWhere.date as object), gte: startDate };
  if (endDate) notesWhere.date = { ...(notesWhere.date as object), lte: endDate };
  const notes = await prisma.qualitativeNote.findMany({ where: notesWhere, orderBy: { timestamp: "desc" }, include: { student: true } });
  for (const n of notes) {
    wsNotes.addRow([n.timestamp, n.student.studentNumber, n.student.name, n.noteText]);
  }

  // Shared styling: title row 1, header row 3, thin borders below row 3 (except the groups sheet, styled above).
  for (const ws of [wsAtt, wsScore, wsNotes]) {
    ws.getRow(1).font = titleFont;
    const headerRow = ws.getRow(3);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    for (let r = 4; r <= ws.rowCount; r++) {
      ws.getRow(r).eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) cell.border = thinBorder;
      });
    }
  }
  wsGroups.getRow(1).font = titleFont;

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `classroom_report_${courseId}_${getTodayStrTaipei()}.xlsx`;
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  res.send(Buffer.from(buffer));
});
