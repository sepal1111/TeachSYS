// Routes for Paper Quizzes (紙本測驗成績管理)
import { Router } from "express";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { broadcastToCourse } from "../realtime";

export const paperQuizzesRouter = autoCatch(Router());

// 取得指定課程的所有紙本測驗列表與摘要統計
paperQuizzesRouter.get("/:courseId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const quizzes = await prisma.paperQuiz.findMany({
    where: { courseId },
    include: {
      subUnit: { select: { id: true, title: true } },
      records: {
        select: {
          id: true,
          studentId: true,
          score: true,
          isAbsent: true,
          photoUrl: true,
          isVerified: true,
          submittedBy: true,
        },
      },
    },
    orderBy: [{ quizDate: "desc" }, { id: "desc" }],
  });

  const totalActiveStudents = await prisma.student.count({
    where: { courseId, isActive: 1 },
  });

  const serialized = quizzes.map((q) => {
    const records = q.records;
    const scoredRecords = records.filter((r) => !r.isAbsent && r.score !== null);
    const absentCount = records.filter((r) => r.isAbsent === 1).length;
    const passCount = scoredRecords.filter((r) => (r.score ?? 0) >= q.passingScore).length;
    const failCount = scoredRecords.filter((r) => (r.score ?? 0) < q.passingScore).length;
    const pendingVerifyCount = records.filter((r) => r.photoUrl && r.isVerified === 0).length;

    let avgScore: number | null = null;
    if (scoredRecords.length > 0) {
      const sum = scoredRecords.reduce((acc, r) => acc + (r.score ?? 0), 0);
      avgScore = Math.round((sum / scoredRecords.length) * 10) / 10;
    }

    return {
      id: q.id,
      course_id: q.courseId,
      title: q.title,
      quiz_date: q.quizDate,
      max_score: q.maxScore,
      passing_score: q.passingScore,
      sub_unit_id: q.subUnitId,
      sub_unit_title: q.subUnit?.title ?? null,
      allow_self_entry: q.allowSelfEntry === 1,
      allow_leader_entry: q.allowLeaderEntry === 1,
      created_at: q.createdAt,
      stats: {
        total_students: totalActiveStudents,
        recorded_count: records.length,
        scored_count: scoredRecords.length,
        absent_count: absentCount,
        pass_count: passCount,
        fail_count: failCount,
        average_score: avgScore,
        pending_verify_count: pendingVerifyCount,
      },
    };
  });

  res.json({ quizzes: serialized });
});

// 建立新紙本測驗
paperQuizzesRouter.post("/:courseId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const {
    title,
    quiz_date,
    max_score = 100,
    passing_score = 60,
    sub_unit_id = null,
    allow_self_entry = 1,
    allow_leader_entry = 1,
  } = req.body ?? {};

  if (!title || !String(title).trim()) {
    res.status(400).json({ detail: "請輸入測驗名稱" });
    return;
  }
  if (!quiz_date) {
    res.status(400).json({ detail: "請選擇測驗日期" });
    return;
  }

  const quiz = await prisma.paperQuiz.create({
    data: {
      courseId,
      title: String(title).trim(),
      quizDate: String(quiz_date),
      maxScore: Number(max_score) || 100,
      passingScore: Number(passing_score) || 60,
      subUnitId: sub_unit_id ? Number(sub_unit_id) : null,
      allowSelfEntry: allow_self_entry ? 1 : 0,
      allowLeaderEntry: allow_leader_entry ? 1 : 0,
      createdAt: new Date().toISOString(),
    },
  });

  broadcastToCourse(courseId, "paper_quizzes_updated");
  res.json({ message: "紙本測驗建立成功！", quiz });
});

// 修改紙本測驗設定
paperQuizzesRouter.put("/:quizId", async (req, res) => {
  const quizId = Number(req.params.quizId);
  const quiz = await prisma.paperQuiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    res.status(404).json({ detail: "測驗不存在" });
    return;
  }

  const {
    title,
    quiz_date,
    max_score,
    passing_score,
    sub_unit_id,
    allow_self_entry,
    allow_leader_entry,
  } = req.body ?? {};

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = String(title).trim();
  if (quiz_date !== undefined) data.quizDate = String(quiz_date);
  if (max_score !== undefined) data.maxScore = Number(max_score);
  if (passing_score !== undefined) data.passingScore = Number(passing_score);
  if (sub_unit_id !== undefined) data.subUnitId = sub_unit_id ? Number(sub_unit_id) : null;
  if (allow_self_entry !== undefined) data.allowSelfEntry = allow_self_entry ? 1 : 0;
  if (allow_leader_entry !== undefined) data.allowLeaderEntry = allow_leader_entry ? 1 : 0;

  const updated = await prisma.paperQuiz.update({
    where: { id: quizId },
    data,
  });

  broadcastToCourse(quiz.courseId, "paper_quizzes_updated");
  res.json({ message: "紙本測驗更新成功！", quiz: updated });
});

// 刪除紙本測驗
paperQuizzesRouter.delete("/:quizId", async (req, res) => {
  const quizId = Number(req.params.quizId);
  const quiz = await prisma.paperQuiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    res.status(404).json({ detail: "測驗不存在" });
    return;
  }

  await prisma.paperQuiz.delete({ where: { id: quizId } });
  broadcastToCourse(quiz.courseId, "paper_quizzes_updated");
  res.json({ message: "紙本測驗及所有登記成績已刪除！" });
});

// 取得該測驗的全班成績矩陣與統計分析
paperQuizzesRouter.get("/:quizId/matrix", async (req, res) => {
  const quizId = Number(req.params.quizId);
  const quiz = await prisma.paperQuiz.findUnique({
    where: { id: quizId },
    include: { subUnit: { select: { id: true, title: true } } },
  });
  if (!quiz) {
    res.status(404).json({ detail: "測驗不存在" });
    return;
  }

  const courseId = quiz.courseId;
  const students = await prisma.student.findMany({
    where: { courseId, isActive: 1 },
    orderBy: { studentNumber: "asc" },
  });

  // 取得目前作用中的分組方案與小組名稱
  const activePlan = await prisma.groupPlan.findFirst({
    where: { courseId, isActive: 1 },
    include: {
      groups: {
        include: {
          members: true,
        },
      },
    },
  });

  const studentGroupMap = new Map<number, { groupId: number; groupName: string; isLeader: boolean }>();
  if (activePlan) {
    for (const g of activePlan.groups) {
      for (const m of g.members) {
        studentGroupMap.set(m.studentId, {
          groupId: g.id,
          groupName: g.groupName,
          isLeader: m.isLeader === 1,
        });
      }
    }
  }

  // 取得所有登記記錄
  const records = await prisma.paperQuizRecord.findMany({
    where: { quizId },
  });
  const recordMap = new Map<number, typeof records[0]>();
  for (const r of records) {
    recordMap.set(r.studentId, r);
  }

  // 整合學生名冊與成績
  const studentRows = students.map((s) => {
    const groupInfo = studentGroupMap.get(s.id);
    const rec = recordMap.get(s.id);

    return {
      student_id: s.id,
      student_number: s.studentNumber,
      student_code: s.studentCode,
      name: s.name,
      english_name: s.englishName,
      gender: s.gender,
      group_id: groupInfo?.groupId ?? null,
      group_name: groupInfo?.groupName ?? "未分組",
      is_leader: groupInfo?.isLeader ?? false,
      score: rec?.score ?? null,
      is_absent: rec?.isAbsent === 1,
      photo_url: rec?.photoUrl ?? null,
      submitted_by: rec?.submittedBy ?? null,
      submitted_by_id: rec?.submittedById ?? null,
      is_verified: rec?.isVerified === 1,
      note: rec?.note ?? "",
      updated_at: rec?.updatedAt ?? null,
    };
  });

  // 計算統計指標
  const scoredList = studentRows
    .filter((r) => !r.is_absent && r.score !== null)
    .map((r) => r.score as number)
    .sort((a, b) => a - b);

  const absentCount = studentRows.filter((r) => r.is_absent).length;
  const passCount = scoredList.filter((s) => s >= quiz.passingScore).length;
  const failCount = scoredList.filter((s) => s < quiz.passingScore).length;
  const pendingVerifyCount = studentRows.filter((r) => r.photo_url && !r.is_verified).length;

  let averageScore: number | null = null;
  let medianScore: number | null = null;
  let maxScoreActual: number | null = null;
  let minScoreActual: number | null = null;

  if (scoredList.length > 0) {
    const sum = scoredList.reduce((a, b) => a + b, 0);
    averageScore = Math.round((sum / scoredList.length) * 10) / 10;
    maxScoreActual = scoredList[scoredList.length - 1];
    minScoreActual = scoredList[0];

    const mid = Math.floor(scoredList.length / 2);
    medianScore =
      scoredList.length % 2 !== 0
        ? scoredList[mid]
        : Math.round(((scoredList[mid - 1] + scoredList[mid]) / 2) * 10) / 10;
  }

  // 級距分佈
  const distribution = {
    range_90_100: scoredList.filter((s) => s >= 90).length,
    range_80_89: scoredList.filter((s) => s >= 80 && s < 90).length,
    range_70_79: scoredList.filter((s) => s >= 70 && s < 80).length,
    range_60_69: scoredList.filter((s) => s >= 60 && s < 70).length,
    range_below_60: scoredList.filter((s) => s < 60).length,
  };

  const passRate =
    scoredList.length > 0 ? Math.round((passCount / scoredList.length) * 1000) / 10 : 0;

  const stats = {
    total_students: students.length,
    submitted_count: records.length,
    scored_count: scoredList.length,
    absent_count: absentCount,
    pass_count: passCount,
    fail_count: failCount,
    pass_rate: passRate,
    average_score: averageScore,
    median_score: medianScore,
    max_score_actual: maxScoreActual,
    min_score_actual: minScoreActual,
    pending_verify_count: pendingVerifyCount,
    distribution,
  };

  res.json({
    quiz: {
      id: quiz.id,
      course_id: quiz.courseId,
      title: quiz.title,
      quiz_date: quiz.quizDate,
      max_score: quiz.maxScore,
      passing_score: quiz.passingScore,
      sub_unit_id: quiz.subUnitId,
      sub_unit_title: quiz.subUnit?.title ?? null,
      allow_self_entry: quiz.allowSelfEntry === 1,
      allow_leader_entry: quiz.allowLeaderEntry === 1,
    },
    stats,
    students: studentRows,
  });
});

// 教師批量儲存成績
paperQuizzesRouter.post("/:quizId/batch-save", async (req, res) => {
  const quizId = Number(req.params.quizId);
  const quiz = await prisma.paperQuiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    res.status(404).json({ detail: "測驗不存在" });
    return;
  }

  const { records } = req.body ?? {};
  if (!Array.isArray(records)) {
    res.status(400).json({ detail: "請提供成績記錄陣列 records" });
    return;
  }

  const now = new Date().toISOString();

  for (const item of records) {
    const studentId = Number(item.student_id);
    if (!studentId) continue;

    const isAbsent = item.is_absent ? 1 : 0;
    const scoreVal =
      isAbsent || item.score === null || item.score === undefined || item.score === ""
        ? null
        : Math.min(Number(item.score), quiz.maxScore);

    const note = item.note !== undefined ? String(item.note) : undefined;
    const isVerified = item.is_verified !== undefined ? (item.is_verified ? 1 : 0) : undefined;

    await prisma.paperQuizRecord.upsert({
      where: { quizId_studentId: { quizId, studentId } },
      update: {
        score: scoreVal,
        isAbsent,
        ...(note !== undefined ? { note } : {}),
        ...(isVerified !== undefined ? { isVerified } : {}),
        submittedBy: item.submitted_by || "teacher",
        updatedAt: now,
      },
      create: {
        quizId,
        studentId,
        score: scoreVal,
        isAbsent,
        note: note ?? null,
        isVerified: isVerified ?? 1, // 教師手動登入預設視為已驗證
        submittedBy: "teacher",
        updatedAt: now,
      },
    });
  }

  broadcastToCourse(quiz.courseId, "paper_quizzes_updated");
  res.json({ message: "紙本測驗成績儲存成功！", count: records.length });
});

// 教師審核照片佐證
paperQuizzesRouter.post("/:quizId/verify/:studentId", async (req, res) => {
  const quizId = Number(req.params.quizId);
  const studentId = Number(req.params.studentId);
  const { is_verified = 1 } = req.body ?? {};

  const quiz = await prisma.paperQuiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    res.status(404).json({ detail: "測驗不存在" });
    return;
  }

  await prisma.paperQuizRecord.updateMany({
    where: { quizId, studentId },
    data: { isVerified: is_verified ? 1 : 0 },
  });

  broadcastToCourse(quiz.courseId, "paper_quizzes_updated");
  res.json({ message: is_verified ? "已核准考卷佐證照片！" : "已取消核准狀態" });
});
