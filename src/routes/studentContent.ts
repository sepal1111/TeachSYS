// Student-facing course materials browsing — read-only, JWT-guarded (requireStudentAuth).
// Mirrors src/routes/units.ts (the teacher-side CRUD) but only ever returns
// visible (is_hidden=0) content, scoped strictly to the token's own course_id.
import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db";
import { autoCatch } from "../asyncRoute";
import { requireStudentAuth } from "../middleware/studentAuth";
import { getNowStrTaipei, getTodayStrTaipei } from "../timezone";
import { getUploadsDir } from "../paths";
import { recordGradeScoreLog, undoScoreLogIds } from "../utils/submissionGrading";
import { listSubmissionComments, createSubmissionComment, type CommentThreadScope } from "../utils/submissionComments";

export const studentContentRouter = autoCatch(Router());
studentContentRouter.use(requireStudentAuth);

// --- 個人累積點數（學生端）---
// 與教師端 routes/scores.ts 的 GET /:courseId/student/:studentId/logs 回傳形狀一致，
// 但改用 req.studentAuth 取得自己的 studentId，不接受 include_undone（學生只看得到有效記錄）。
studentContentRouter.get("/me/scores", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const { start_date, end_date } = req.query as Record<string, string | undefined>;

  const where: Record<string, unknown> = { courseId, studentId, isUndone: 0 };
  if (start_date) where.date = { ...(where.date as object), gte: start_date };
  if (end_date) where.date = { ...(where.date as object), lte: end_date };

  const logs = await prisma.scoreLog.findMany({
    where,
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  });

  const groupIds = [...new Set(logs.map((l) => l.groupId).filter((v): v is number => v != null))];
  const groups = await prisma.group.findMany({ where: { id: { in: groupIds } } });
  const groupNameMap = new Map(groups.map((g) => [g.id, g.groupName]));

  const enriched = logs.map((l) => ({
    id: l.id,
    rule_title: l.ruleTitle,
    score: l.score,
    category: l.category,
    date: l.date,
    timestamp: l.timestamp,
    group_name: l.groupId != null ? groupNameMap.get(l.groupId) ?? null : null,
  }));

  const totalScore = enriched.reduce((sum, l) => sum + l.score, 0);
  const positiveScore = enriched.filter((l) => l.score > 0).reduce((sum, l) => sum + l.score, 0);
  const negativeScore = enriched.filter((l) => l.score < 0).reduce((sum, l) => sum + l.score, 0);
  const todayStr = getTodayStrTaipei();
  const todayScore = enriched.filter((l) => l.date === todayStr).reduce((sum, l) => sum + l.score, 0);

  res.json({ total_score: totalScore, positive_score: positiveScore, negative_score: negativeScore, today_score: todayScore, logs: enriched });
});
// --- 我的小組（學生端）--- 對應課程當前生效的分組方案（教師分組頁籤所見的同一套），
// 用於學生入口首頁的「我的小組」卡片；沒有生效方案或尚未被編入小組時回傳 group: null。
studentContentRouter.get("/me/group", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;

  const plan = await prisma.groupPlan.findFirst({ where: { courseId, isActive: 1 } });
  const myMembership = plan ? await prisma.groupMember.findFirst({ where: { planId: plan.id, studentId } }) : null;
  if (!myMembership) {
    res.json({ group: null });
    return;
  }

  const group = await prisma.group.findUnique({ where: { id: myMembership.groupId } });
  const members = await prisma.groupMember.findMany({
    where: { planId: plan!.id, groupId: myMembership.groupId },
    include: { student: true },
  });

  res.json({
    group: {
      id: group!.id,
      name: group!.groupName,
      members: members
        .map((m) => ({ id: m.student.id, name: m.student.name, student_number: m.student.studentNumber, is_me: m.student.id === studentId }))
        .sort((a, b) => a.student_number - b.student_number),
    },
  });
});

const upload = multer({ storage: multer.memoryStorage() });

function parseSubmissionTypes(csv: string | null): string[] {
  return csv ? csv.split(",").filter(Boolean) : [];
}

function serializeSubmission(s: { id: number; filesJson: string | null; link: string | null; textContent: string | null; submittedAt: string | null; isLate: number; turnedIn: number; locked: number; teacherReopened: number; resubmitRequested: number; score: number | null; feedback: string | null; gradedAt: string | null; answersJson: string | null; maxScore: number | null } | null) {
  if (!s) return null;
  return {
    files: s.filesJson ? (JSON.parse(s.filesJson) as unknown[]) : [],
    link: s.link,
    text_content: s.textContent,
    submitted_at: s.submittedAt,
    is_late: !!s.isLate,
    turned_in: !!s.turnedIn,
    locked: !!s.locked,
    teacher_reopened: !!s.teacherReopened,
    resubmit_requested: !!s.resubmitRequested,
    score: s.score,
    feedback: s.feedback,
    graded_at: s.gradedAt,
    answers: s.answersJson ? JSON.parse(s.answersJson) : null,
    max_score: s.maxScore,
  };
}

interface QuizQuestionPublic {
  id: string;
  type: string;
  question_text: string;
  options: string[];
  correct_answer?: string;
  points: number;
}

/** Never leak correct_answer to a student who hasn't submitted yet — and even after
 *  submitting, only if the teacher opted in via reveal_answers_after_submit. */
function quizQuestionsForStudent(
  su: { quizQuestions: string | null; revealAnswersAfterSubmit: number },
  hasSubmitted: boolean
): QuizQuestionPublic[] {
  const questions: QuizQuestionPublic[] = su.quizQuestions ? JSON.parse(su.quizQuestions) : [];
  const canReveal = hasSubmitted && su.revealAnswersAfterSubmit;
  if (canReveal) return questions;
  return questions.map(({ correct_answer, ...rest }) => rest);
}

studentContentRouter.get("/units", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;

  const units = await prisma.unit.findMany({
    where: { courseId, isHidden: 0 },
    orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
    include: {
      subUnits: {
        where: { isHidden: 0 },
        orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
        include: {
          materials: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
          readingProgress: { where: { studentId } },
        },
      },
    },
  });

  // Resolve "my group" per distinct group_plan_id used by any assignment sub-unit,
  // so a group-type assignment can show the shared team submission instead of a personal one.
  const groupPlanIds = Array.from(
    new Set(units.flatMap((u) => u.subUnits.map((su) => su.groupPlanId).filter((id): id is number => id != null)))
  );
  const myMemberships = groupPlanIds.length
    ? await prisma.groupMember.findMany({ where: { studentId, planId: { in: groupPlanIds } } })
    : [];
  const myGroupByPlan = new Map(myMemberships.map((m) => [m.planId, m.groupId]));

  const allSubUnitIds = units.flatMap((u) => u.subUnits.map((su) => su.id));
  const mySubmissions = allSubUnitIds.length
    ? await prisma.submission.findMany({
        where: {
          subUnitId: { in: allSubUnitIds },
          OR: [{ studentId }, { groupId: { in: Array.from(myGroupByPlan.values()) } }],
        },
      })
    : [];

  // 我的提問串留言數（顯示在「💬 提問老師 (N)」按鈕上，不用展開才知道有沒有新回覆）。
  const myCommentGroups = allSubUnitIds.length
    ? await prisma.submissionComment.groupBy({
        by: ["subUnitId", "studentId", "groupId"],
        where: {
          subUnitId: { in: allSubUnitIds },
          OR: [{ studentId }, { groupId: { in: Array.from(myGroupByPlan.values()) } }],
        },
        _count: { id: true },
      })
    : [];

  res.json(
    units.map((u) => ({
      id: u.id,
      title: u.title,
      sub_units: u.subUnits.map((su) => {
        const isAssignment = su.category === "assignment";
        const isQuiz = su.category === "quiz";
        const myGroupId = su.groupPlanId != null ? myGroupByPlan.get(su.groupPlanId) ?? null : null;
        const mySubmission = isAssignment
          ? mySubmissions.find((s) =>
              su.assignmentType === "group" ? s.subUnitId === su.id && s.groupId === myGroupId : s.subUnitId === su.id && s.studentId === studentId
            ) ?? null
          : isQuiz
          ? mySubmissions.find((s) => s.subUnitId === su.id && s.studentId === studentId) ?? null
          : null;
        const myCommentCount =
          isAssignment && su.assignmentType === "group"
            ? myCommentGroups.find((c) => c.subUnitId === su.id && c.groupId === myGroupId)?._count.id ?? 0
            : isAssignment || isQuiz
            ? myCommentGroups.find((c) => c.subUnitId === su.id && c.studentId === studentId)?._count.id ?? 0
            : 0;

        return {
          id: su.id,
          title: su.title,
          category: su.category,
          description: su.description,
          materials: su.materials,
          viewed: su.readingProgress.length > 0,
          view_count: su.readingProgress[0]?.viewCount ?? 0,
          last_viewed_at: su.readingProgress[0]?.lastViewedAt ?? null,
          ...(isAssignment
            ? {
                due_date: su.dueDate,
                auto_lock_overdue: !!su.autoLockOverdue,
                submission_types: parseSubmissionTypes(su.submissionTypes),
                assignment_type: su.assignmentType,
                my_group_id: myGroupId,
                submission: serializeSubmission(mySubmission),
                comment_count: myCommentCount,
              }
            : {}),
          ...(isQuiz
            ? {
                due_date: su.dueDate,
                auto_lock_overdue: !!su.autoLockOverdue,
                reveal_answers_after_submit: !!su.revealAnswersAfterSubmit,
                quiz_questions: quizQuestionsForStudent(su, !!mySubmission),
                submission: serializeSubmission(mySubmission),
                comment_count: myCommentCount,
              }
            : {}),
        };
      }),
    }))
  );
});

studentContentRouter.post("/subunits/:subUnitId/view", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const subUnitId = Number(req.params.subUnitId);

  const subUnit = await prisma.subUnit.findFirst({ where: { id: subUnitId, unit: { courseId } } });
  if (!subUnit) {
    res.status(404).json({ detail: "Sub-unit not found" });
    return;
  }

  const now = getNowStrTaipei();
  const existing = await prisma.readingProgress.findUnique({
    where: { subUnitId_studentId: { subUnitId, studentId } },
  });

  if (existing) {
    await prisma.readingProgress.update({
      where: { id: existing.id },
      data: { lastViewedAt: now, viewCount: existing.viewCount + 1 },
    });
  } else {
    await prisma.readingProgress.create({
      data: { subUnitId, studentId, firstViewedAt: now, lastViewedAt: now, viewCount: 1 },
    });
  }

  res.json({ message: "已記錄閱讀進度" });
});

// --- 作業繳交（學生端） ---

type SubmissionRecord = Awaited<ReturnType<typeof prisma.submission.findFirst>>;

async function loadVisibleAssignment(courseId: number, subUnitId: number) {
  const subUnit = await prisma.subUnit.findFirst({
    where: { id: subUnitId, isHidden: 0, category: "assignment", unit: { courseId, isHidden: 0 } },
  });
  return subUnit;
}

/** Resolves the caller's group for a group-type assignment, or null with a 400 already sent. */
async function resolveMyGroupId(
  res: import("express").Response,
  subUnit: NonNullable<Awaited<ReturnType<typeof loadVisibleAssignment>>>,
  studentId: number
): Promise<number | null> {
  if (!subUnit.groupPlanId) {
    res.status(400).json({ detail: "此作業尚未設定分組方案，請聯絡老師" });
    return null;
  }
  const membership = await prisma.groupMember.findFirst({ where: { planId: subUnit.groupPlanId, studentId } });
  if (!membership) {
    res.status(400).json({ detail: "你尚未被分配到小組，請聯絡老師" });
    return null;
  }
  return membership.groupId;
}

function checkSubmittable(subUnit: { dueDate: string | null; autoLockOverdue: number }, existing: SubmissionRecord): string | null {
  if (existing?.locked) {
    return "作業已被鎖定，無法重新繳交，如需重新繳交請點選「申請重新繳交」";
  }
  if (subUnit.dueDate && subUnit.autoLockOverdue && !existing?.teacherReopened) {
    if (getTodayStrTaipei() > subUnit.dueDate) {
      return "作業已超過繳交期限，系統已自動鎖定禁止繳交。";
    }
  }
  return null;
}

studentContentRouter.post("/subunits/:subUnitId/submit", upload.array("files", 5), async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const subUnitId = Number(req.params.subUnitId);
  const subUnit = await loadVisibleAssignment(courseId, subUnitId);
  if (!subUnit) {
    res.status(404).json({ detail: "作業不存在" });
    return;
  }

  const isGroup = subUnit.assignmentType === "group";
  const groupId = isGroup ? await resolveMyGroupId(res, subUnit, studentId) : null;
  if (isGroup && groupId === null) return; // resolveMyGroupId already sent the 400 response

  const existing = isGroup
    ? await prisma.submission.findUnique({ where: { subUnitId_groupId: { subUnitId, groupId: groupId! } } })
    : await prisma.submission.findUnique({ where: { subUnitId_studentId: { subUnitId, studentId } } });

  const blockReason = checkSubmittable(subUnit, existing);
  if (blockReason) {
    res.status(400).json({ detail: blockReason });
    return;
  }

  const allowedTypes = parseSubmissionTypes(subUnit.submissionTypes);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const link = typeof req.body?.link === "string" ? req.body.link.trim() : undefined;
  const textContent = typeof req.body?.text_content === "string" ? req.body.text_content : undefined;

  if (files.length && !allowedTypes.includes("file")) {
    res.status(400).json({ detail: "此作業不接受檔案上傳" });
    return;
  }
  if (link && !allowedTypes.includes("link")) {
    res.status(400).json({ detail: "此作業不接受連結繳交" });
    return;
  }
  if (textContent?.trim() && !allowedTypes.includes("text")) {
    res.status(400).json({ detail: "此作業不接受文字繳交" });
    return;
  }

  let filesJson: string | undefined;
  if (files.length) {
    const ownerSlug = isGroup ? `group_${groupId}` : `student_${studentId}`;
    const dir = path.join(getUploadsDir(), "submissions", String(courseId), String(subUnitId), ownerSlug);
    fs.mkdirSync(dir, { recursive: true });
    const existingFiles: { file_name: string; url: string }[] = existing?.filesJson ? JSON.parse(existing.filesJson) : [];
    const newFiles = files.map((f) => {
      const ext = path.extname(f.originalname);
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      fs.writeFileSync(path.join(dir, filename), f.buffer);
      return { file_name: f.originalname, url: `/uploads/submissions/${courseId}/${subUnitId}/${ownerSlug}/${filename}` };
    });
    filesJson = JSON.stringify([...existingFiles, ...newFiles]);
  }

  const isLate = subUnit.dueDate ? getTodayStrTaipei() > subUnit.dueDate : false;
  const data: Record<string, unknown> = {
    submittedAt: getNowStrTaipei(),
    isLate: isLate ? 1 : 0,
    turnedIn: 1,
    locked: 0,
    score: null,
    feedback: null,
    resubmitRequested: 0,
  };
  if (filesJson !== undefined) data.filesJson = filesJson;
  if (link !== undefined) data.link = link || null;
  if (textContent !== undefined) data.textContent = textContent;

  if (isGroup) {
    await prisma.submission.upsert({
      where: { subUnitId_groupId: { subUnitId, groupId: groupId! } },
      create: { subUnitId, groupId: groupId!, submitterId: studentId, ...data },
      update: { submitterId: studentId, ...data },
    });
  } else {
    await prisma.submission.upsert({
      where: { subUnitId_studentId: { subUnitId, studentId } },
      create: { subUnitId, studentId, ...data },
      update: data,
    });
  }

  res.json({ message: "作業已送出！" });
});

studentContentRouter.post("/subunits/:subUnitId/request_resubmit", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const subUnitId = Number(req.params.subUnitId);
  const subUnit = await loadVisibleAssignment(courseId, subUnitId);
  if (!subUnit) {
    res.status(404).json({ detail: "作業不存在" });
    return;
  }

  const isGroup = subUnit.assignmentType === "group";
  const now = getNowStrTaipei();
  if (isGroup) {
    const groupId = await resolveMyGroupId(res, subUnit, studentId);
    if (groupId === null) return;
    await prisma.submission.upsert({
      where: { subUnitId_groupId: { subUnitId, groupId } },
      create: { subUnitId, groupId, resubmitRequested: 1, resubmitRequestedAt: now },
      update: { resubmitRequested: 1, resubmitRequestedAt: now },
    });
  } else {
    await prisma.submission.upsert({
      where: { subUnitId_studentId: { subUnitId, studentId } },
      create: { subUnitId, studentId, resubmitRequested: 1, resubmitRequestedAt: now },
      update: { resubmitRequested: 1, resubmitRequestedAt: now },
    });
  }

  res.json({ message: "已送出重新繳交申請，請等待老師同意" });
});

studentContentRouter.delete("/subunits/:subUnitId/files/:fileIndex", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const subUnitId = Number(req.params.subUnitId);
  const fileIndex = Number(req.params.fileIndex);
  const subUnit = await loadVisibleAssignment(courseId, subUnitId);
  if (!subUnit) {
    res.status(404).json({ detail: "作業不存在" });
    return;
  }

  const isGroup = subUnit.assignmentType === "group";
  const existing = isGroup
    ? await (async () => {
        const groupId = await resolveMyGroupId(res, subUnit, studentId);
        return groupId === null ? undefined : prisma.submission.findUnique({ where: { subUnitId_groupId: { subUnitId, groupId } } });
      })()
    : await prisma.submission.findUnique({ where: { subUnitId_studentId: { subUnitId, studentId } } });
  if (existing === undefined) return; // resolveMyGroupId already sent the 400 response
  if (!existing) {
    res.status(404).json({ detail: "尚未繳交" });
    return;
  }
  if (existing.locked) {
    res.status(400).json({ detail: "作業已鎖定，無法刪除檔案" });
    return;
  }

  const files: { file_name: string; url: string }[] = existing.filesJson ? JSON.parse(existing.filesJson) : [];
  if (fileIndex < 0 || fileIndex >= files.length) {
    res.status(400).json({ detail: "檔案不存在" });
    return;
  }
  files.splice(fileIndex, 1);

  await prisma.submission.update({ where: { id: existing.id }, data: { filesJson: JSON.stringify(files) } });
  res.json({ message: "檔案已刪除" });
});

// --- 線上測驗作答（學生端）---
// 送出即批改鎖定（比照 kyps-class 的 submitQuizAssignment 規則：選擇題/是非題完全比對，
// 簡答題忽略大小寫與頭尾空白），若想重新作答須走既有的「申請重新繳交」→ 教師解鎖流程。
// 分數直接寫入 score_logs（recordGradeScoreLog），與作業評分共用同一套排行榜整合機制。

async function loadVisibleQuiz(courseId: number, subUnitId: number) {
  const subUnit = await prisma.subUnit.findFirst({
    where: { id: subUnitId, isHidden: 0, category: "quiz", unit: { courseId, isHidden: 0 } },
  });
  return subUnit;
}

studentContentRouter.post("/subunits/:subUnitId/submit_quiz", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const subUnitId = Number(req.params.subUnitId);
  const subUnit = await loadVisibleQuiz(courseId, subUnitId);
  if (!subUnit) {
    res.status(404).json({ detail: "測驗不存在" });
    return;
  }

  const existing = await prisma.submission.findUnique({ where: { subUnitId_studentId: { subUnitId, studentId } } });
  const blockReason = checkSubmittable(subUnit, existing);
  if (blockReason) {
    res.status(400).json({ detail: blockReason });
    return;
  }

  const questions: { id: string; type: string; correct_answer?: string; points: number }[] = subUnit.quizQuestions
    ? JSON.parse(subUnit.quizQuestions)
    : [];
  const rawAnswers: Record<string, unknown> = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};

  const cleanAnswers: Record<string, string> = {};
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    const points = Number(q.points) || 0;
    maxScore += points;
    const studentAnswer = String(rawAnswers[q.id] ?? "").trim();
    cleanAnswers[q.id] = studentAnswer;
    const correctAnswer = String(q.correct_answer ?? "").trim();
    const isCorrect =
      q.type === "short_answer" ? studentAnswer.toLowerCase() === correctAnswer.toLowerCase() : studentAnswer === correctAnswer;
    if (isCorrect) score += points;
  }

  await undoScoreLogIds(prisma, existing?.scoreLogIdsJson ?? null);
  const logId = await recordGradeScoreLog(prisma, { courseId, studentId, ruleTitle: `測驗成績：${subUnit.title}`, score });

  const isLate = subUnit.dueDate ? getTodayStrTaipei() > subUnit.dueDate : false;

  await prisma.submission.upsert({
    where: { subUnitId_studentId: { subUnitId, studentId } },
    create: {
      subUnitId,
      studentId,
      submittedAt: getNowStrTaipei(),
      isLate: isLate ? 1 : 0,
      turnedIn: 1,
      locked: 1,
      answersJson: JSON.stringify(cleanAnswers),
      score,
      maxScore,
      gradedAt: getNowStrTaipei(),
      scoreLogIdsJson: JSON.stringify([logId]),
      resubmitRequested: 0,
    },
    update: {
      submittedAt: getNowStrTaipei(),
      isLate: isLate ? 1 : 0,
      turnedIn: 1,
      locked: 1,
      answersJson: JSON.stringify(cleanAnswers),
      score,
      maxScore,
      feedback: null,
      gradedAt: getNowStrTaipei(),
      scoreLogIdsJson: JSON.stringify([logId]),
      resubmitRequested: 0,
    },
  });

  res.json({ message: "測驗已送出，系統已自動完成批改！", score, max_score: maxScore });
});

// --- 提問串（Submission Comments，學生端）---
// 開放給作業與測驗（呼應教師端 units.ts 的 loadAssignment 同時允許 assignment/quiz），
// 個人作業/測驗以 studentId 定位討論串，小組作業以 groupId 定位（全組共用同一串）。

async function loadVisibleAssignmentOrQuiz(courseId: number, subUnitId: number) {
  return prisma.subUnit.findFirst({
    where: { id: subUnitId, isHidden: 0, category: { in: ["assignment", "quiz"] }, unit: { courseId, isHidden: 0 } },
  });
}

/** 小組作業且尚未分組時，resolveMyGroupId 已經送出 400 回應，呼叫端應直接 return。 */
async function resolveCommentScope(
  res: import("express").Response,
  subUnit: NonNullable<Awaited<ReturnType<typeof loadVisibleAssignmentOrQuiz>>>,
  studentId: number
): Promise<CommentThreadScope | null> {
  const isGroup = subUnit.category === "assignment" && subUnit.assignmentType === "group";
  if (!isGroup) return { subUnitId: subUnit.id, studentId };
  const groupId = await resolveMyGroupId(res, subUnit, studentId);
  return groupId === null ? null : { subUnitId: subUnit.id, groupId };
}

studentContentRouter.get("/subunits/:subUnitId/comments", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const subUnitId = Number(req.params.subUnitId);
  const subUnit = await loadVisibleAssignmentOrQuiz(courseId, subUnitId);
  if (!subUnit) {
    res.status(404).json({ detail: "作業或測驗不存在" });
    return;
  }
  const scope = await resolveCommentScope(res, subUnit, studentId);
  if (!scope) return; // resolveCommentScope already sent the 400 response

  res.json(await listSubmissionComments(prisma, scope));
});

studentContentRouter.post("/subunits/:subUnitId/comments", async (req, res) => {
  const { courseId, studentId } = req.studentAuth!;
  const subUnitId = Number(req.params.subUnitId);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    res.status(400).json({ detail: "請輸入訊息內容" });
    return;
  }

  const subUnit = await loadVisibleAssignmentOrQuiz(courseId, subUnitId);
  if (!subUnit) {
    res.status(404).json({ detail: "作業或測驗不存在" });
    return;
  }
  const scope = await resolveCommentScope(res, subUnit, studentId);
  if (!scope) return;

  await createSubmissionComment(prisma, scope, "student", studentId, message, getNowStrTaipei());
  res.json(await listSubmissionComments(prisma, scope));
});
