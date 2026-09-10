// Prisma client bound to the runtime-resolved db file (see paths.ts), plus an
// idempotent schema bootstrap that mirrors app/database.py's init_db(): plain
// `CREATE TABLE IF NOT EXISTS` / best-effort `ALTER TABLE ADD COLUMN`, run on
// every startup. We deliberately do NOT use `prisma migrate` because the
// database file's location is only known at runtime (portable USB/bin dir).
import crypto from "crypto";
import { getDbPath, getPackagedPrismaEngineLibraryPath } from "./paths";

const packagedEngine = getPackagedPrismaEngineLibraryPath();
if (packagedEngine) process.env.PRISMA_QUERY_ENGINE_LIBRARY = packagedEngine;

// Imported after the env override above so PrismaClient picks it up when constructed.
import { PrismaClient } from "@prisma/client";

const dbPath = getDbPath();

export const prisma = new PrismaClient({
  datasourceUrl: `file:${dbPath}`,
});

async function tryAlter(sql: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch {
    // Column/table already exists — same best-effort semantics as the Python version's try/except.
  }
}

export async function initSchema(): Promise<void> {
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");
  // journal_mode=WAL returns the resulting mode as a row, so SQLite rejects it via $executeRaw.
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      teacher_type TEXT NOT NULL DEFAULT 'homeroom',
      description TEXT,
      seat_rows INTEGER DEFAULT 5,
      seat_cols INTEGER DEFAULT 6,
      blackboard_position TEXT DEFAULT 'top',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS group_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      icon_url TEXT NULL,
      order_index INTEGER DEFAULT 0,
      plan_id INTEGER NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      student_number INTEGER NOT NULL,
      student_code TEXT NULL,
      name TEXT NOT NULL,
      english_name TEXT NULL,
      gender TEXT NOT NULL DEFAULT 'M',
      group_id INTEGER NULL,
      seat_row INTEGER NULL,
      seat_col INTEGER NULL,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE SET NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      FOREIGN KEY(plan_id) REFERENCES group_plans(id) ON DELETE CASCADE,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(plan_id, student_id)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(course_id, student_id, date)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS evaluation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'positive',
      score_value INTEGER NOT NULL,
      icon TEXT DEFAULT '⭐',
      is_default INTEGER DEFAULT 0,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS score_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      rule_id INTEGER NULL,
      rule_title TEXT NOT NULL,
      score INTEGER NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      is_undone INTEGER DEFAULT 0,
      plan_id INTEGER NULL,
      group_id INTEGER NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS qualitative_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      date TEXT NOT NULL,
      media_url TEXT NULL,
      media_type TEXT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS undo_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_undone INTEGER DEFAULT 0
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(
    "INSERT OR IGNORE INTO system_settings (key, value) VALUES ('password_prefix', 'Admin');"
  );
  // Generated once per install and persisted in the DB (never in a config file), since a
  // portable USB/bin deployment has no durable place for a server-side env secret — this
  // signs/verifies student LMS JWTs (see src/middleware/studentAuth.ts).
  const jwtSecretExists = await prisma.systemSetting.findUnique({ where: { key: "jwt_secret" } });
  if (!jwtSecretExists) {
    await prisma.systemSetting.create({ data: { key: "jwt_secret", value: crypto.randomBytes(48).toString("hex") } });
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS system_sessions (
      token TEXT PRIMARY KEY,
      created_date TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --- Phase 2: 課程素材與單元結構模組 (units -> sub_units -> materials) + reading progress ---
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sub_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'material',
      description TEXT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sub_unit_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sub_unit_id) REFERENCES sub_units(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sub_unit_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      first_viewed_at TEXT NOT NULL,
      last_viewed_at TEXT NOT NULL,
      view_count INTEGER DEFAULT 1,
      FOREIGN KEY(sub_unit_id) REFERENCES sub_units(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(sub_unit_id, student_id)
    );
  `);

  // 教學日誌（Lesson Log）：以課程為單位的教學進度／課堂記事，跟 qualitative_notes（針對個別學生）
  // 是不同維度的紀錄，sub_unit_id 選填讓老師可以選擇性關聯到已建立的單元結構標示「教到哪」。
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS lesson_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      sub_unit_id INTEGER NULL,
      content TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'general',
      is_done INTEGER DEFAULT 0,
      media_url TEXT NULL,
      media_type TEXT NULL,
      date TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY(sub_unit_id) REFERENCES sub_units(id) ON DELETE SET NULL
    );
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_lesson_logs_course ON lesson_logs(course_id, date);"
  );

  // --- Phase 3: 作業與小組共同作業模組 (submissions) ---
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sub_unit_id INTEGER NOT NULL,
      student_id INTEGER NULL,
      group_id INTEGER NULL,
      submitter_id INTEGER NULL,
      files_json TEXT NULL,
      link TEXT NULL,
      text_content TEXT NULL,
      submitted_at TEXT NULL,
      is_late INTEGER DEFAULT 0,
      turned_in INTEGER DEFAULT 0,
      locked INTEGER DEFAULT 0,
      teacher_reopened INTEGER DEFAULT 0,
      resubmit_requested INTEGER DEFAULT 0,
      resubmit_requested_at TEXT NULL,
      score INTEGER NULL,
      feedback TEXT NULL,
      member_scores_json TEXT NULL,
      graded_at TEXT NULL,
      score_log_ids_json TEXT NULL,
      answers_json TEXT NULL,
      max_score INTEGER NULL,
      FOREIGN KEY(sub_unit_id) REFERENCES sub_units(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
      UNIQUE(sub_unit_id, student_id),
      UNIQUE(sub_unit_id, group_id)
    );
  `);

  // 提問串（Submission Comments）：建立後不可編輯刪除，僅提供 CREATE/LIST，見 utils/submissionComments.ts。
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS submission_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sub_unit_id INTEGER NOT NULL,
      student_id INTEGER NULL,
      group_id INTEGER NULL,
      author_role TEXT NOT NULL,
      author_id INTEGER NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(sub_unit_id) REFERENCES sub_units(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_submission_comments_thread ON submission_comments(sub_unit_id, student_id, group_id);"
  );

  // 即時互動牆（Live Wall）：教師開一個限時場次，學生每人限交一則文字/手繪/拍照貼文。
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS live_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      title TEXT NULL,
      show_names INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);
  // Partial unique index：同一課程同時只能有一個 is_active=1 的場次，DB 層強制（app 層也會
  // 在開新場次前先關閉舊場次，這裡是雙重保險，避免競態或漏改造成同時兩個進行中場次）。
  await prisma.$executeRawUnsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_one_active ON live_sessions(course_id) WHERE is_active = 1;"
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS live_wall_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      text_content TEXT NULL,
      image_url TEXT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(session_id, student_id)
    );
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_live_wall_posts_session ON live_wall_posts(session_id);"
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS point_card_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NULL,
      name TEXT NOT NULL,
      card_theme TEXT NOT NULL DEFAULT 'score_card_A',
      allowed_course_ids TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS point_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      series_id INTEGER NULL,
      card_no TEXT NULL,
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      score INTEGER NOT NULL,
      image TEXT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY(series_id) REFERENCES point_card_series(id) ON DELETE SET NULL,
      UNIQUE(course_id, code)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS point_card_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      point_card_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      score_log_id INTEGER NULL,
      date TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(point_card_id) REFERENCES point_cards(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(point_card_id, student_id, date)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS reward_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NULL,
      reward_type TEXT NOT NULL,
      points_cost INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT -1,
      image_url TEXT NOT NULL,
      card_series TEXT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS reward_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reward_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      points_spent INTEGER NOT NULL,
      status TEXT NOT NULL,
      score_log_id INTEGER NULL,
      request_note TEXT NULL,
      teacher_note TEXT NULL,
      created_at TEXT NOT NULL,
      approved_at TEXT NULL,
      fulfilled_at TEXT NULL,
      FOREIGN KEY(reward_id) REFERENCES reward_items(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_reward_items_course ON reward_items(course_id, is_active);"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_reward_redemptions_student ON reward_redemptions(student_id, status);"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_reward_redemptions_course ON reward_redemptions(course_id, status);"
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS paper_quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject TEXT DEFAULT '',
      quiz_date TEXT NOT NULL,
      max_score REAL DEFAULT 100,
      passing_score REAL DEFAULT 60,
      sub_unit_id INTEGER NULL,
      allow_self_entry INTEGER DEFAULT 1,
      allow_leader_entry INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY(sub_unit_id) REFERENCES sub_units(id) ON DELETE SET NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS paper_quiz_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      score REAL NULL,
      is_absent INTEGER DEFAULT 0,
      leave_type TEXT DEFAULT '',
      allow_makeup INTEGER DEFAULT 0,
      is_makeup INTEGER DEFAULT 0,
      makeup_score REAL NULL,
      photo_url TEXT NULL,
      submitted_by TEXT DEFAULT 'teacher',
      submitted_by_id INTEGER NULL,
      is_verified INTEGER DEFAULT 0,
      note TEXT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quiz_id) REFERENCES paper_quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(quiz_id, student_id)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS group_discussion_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      plan_id INTEGER NULL,
      leader_id INTEGER NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY(plan_id) REFERENCES group_plans(id) ON DELETE SET NULL,
      FOREIGN KEY(leader_id) REFERENCES students(id) ON DELETE SET NULL
    );
  `);

  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_paper_quizzes_course ON paper_quizzes(course_id);"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_paper_quiz_records_quiz ON paper_quiz_records(quiz_id, student_id);"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_group_discussion_logs_course ON group_discussion_logs(course_id, group_id);"
  );

  // 課堂即時公布欄：原本只存 localStorage，改為寫入資料庫（見 routes/bulletin.ts）。
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS bulletin_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_bulletin_posts_course ON bulletin_posts(course_id, order_index);"
  );

  // 臨時檔案蒐集 (File Collections)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS file_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NULL,
      allowed_extensions TEXT NULL,
      allow_upload INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_file_collections_course ON file_collections(course_id, order_index);"
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS file_collection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      display_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NULL,
      uploaded_at TEXT NOT NULL,
      updated_at TEXT NULL,
      FOREIGN KEY(collection_id) REFERENCES file_collections(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_file_collection_items_col ON file_collection_items(collection_id);"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_file_collection_items_stu ON file_collection_items(student_id);"
  );

  // Column migrations for DBs created by older schema versions (safe no-op if already present).
  await tryAlter("ALTER TABLE group_members ADD COLUMN is_leader INTEGER DEFAULT 0;");
  await tryAlter("ALTER TABLE groups ADD COLUMN icon_url TEXT NULL;");
  await tryAlter("ALTER TABLE groups ADD COLUMN plan_id INTEGER NULL;");
  await tryAlter("ALTER TABLE score_logs ADD COLUMN plan_id INTEGER NULL;");
  await tryAlter("ALTER TABLE score_logs ADD COLUMN group_id INTEGER NULL;");
  await tryAlter("ALTER TABLE courses ADD COLUMN seat_rows INTEGER DEFAULT 5;");
  await tryAlter("ALTER TABLE courses ADD COLUMN seat_cols INTEGER DEFAULT 6;");
  await tryAlter("ALTER TABLE courses ADD COLUMN blackboard_position TEXT DEFAULT 'top';");
  await tryAlter("ALTER TABLE students ADD COLUMN student_code TEXT NULL;");
  await tryAlter("ALTER TABLE students ADD COLUMN english_name TEXT NULL;");
  await tryAlter("ALTER TABLE students ADD COLUMN seat_row INTEGER NULL;");
  await tryAlter("ALTER TABLE students ADD COLUMN seat_col INTEGER NULL;");
  await tryAlter("ALTER TABLE students ADD COLUMN password_hash TEXT NULL;");
  await tryAlter("ALTER TABLE students ADD COLUMN login_account TEXT NULL;");
  await prisma.$executeRawUnsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_students_login_account ON students(login_account);"
  );
  await tryAlter("ALTER TABLE qualitative_notes ADD COLUMN media_url TEXT NULL;");
  await tryAlter("ALTER TABLE qualitative_notes ADD COLUMN media_type TEXT NULL;");
  await tryAlter("ALTER TABLE sub_units ADD COLUMN submission_types TEXT NULL;");
  await tryAlter("ALTER TABLE sub_units ADD COLUMN assignment_type TEXT NOT NULL DEFAULT 'individual';");
  await tryAlter("ALTER TABLE sub_units ADD COLUMN group_plan_id INTEGER NULL;");
  await tryAlter("ALTER TABLE sub_units ADD COLUMN due_date TEXT NULL;");
  await tryAlter("ALTER TABLE sub_units ADD COLUMN auto_lock_overdue INTEGER DEFAULT 0;");
  await tryAlter("ALTER TABLE sub_units ADD COLUMN quiz_questions TEXT NULL;");
  await tryAlter("ALTER TABLE sub_units ADD COLUMN reveal_answers_after_submit INTEGER DEFAULT 1;");
  await tryAlter("ALTER TABLE submissions ADD COLUMN answers_json TEXT NULL;");
  await tryAlter("ALTER TABLE submissions ADD COLUMN max_score INTEGER NULL;");
  await tryAlter("ALTER TABLE sub_units ADD COLUMN publish_at TEXT NULL;");
  await tryAlter("ALTER TABLE point_cards ADD COLUMN series_id INTEGER NULL;");
  await tryAlter("ALTER TABLE point_cards ADD COLUMN card_no TEXT NULL;");
  await tryAlter("ALTER TABLE point_cards ADD COLUMN image TEXT NULL;");
  await tryAlter("ALTER TABLE paper_quizzes ADD COLUMN subject TEXT DEFAULT '';");
  await tryAlter("ALTER TABLE paper_quiz_records ADD COLUMN leave_type TEXT DEFAULT '';");
  await tryAlter("ALTER TABLE paper_quiz_records ADD COLUMN allow_makeup INTEGER DEFAULT 0;");
  await tryAlter("ALTER TABLE paper_quiz_records ADD COLUMN is_makeup INTEGER DEFAULT 0;");
  await tryAlter("ALTER TABLE paper_quiz_records ADD COLUMN makeup_score REAL NULL;");

  // Ensure every course has an active group_plan, and backfill group_members from
  // legacy students.group_id, exactly like the Python auto-migration block.
  const courses = await prisma.course.findMany({ select: { id: true } });
  for (const c of courses) {
    let plan = await prisma.groupPlan.findFirst({ where: { courseId: c.id, isActive: 1 } });
    if (!plan) {
      const anyPlan = await prisma.groupPlan.findFirst({ where: { courseId: c.id } });
      if (!anyPlan) {
        plan = await prisma.groupPlan.create({ data: { courseId: c.id, name: "常態分組", isActive: 1 } });
      } else {
        plan = await prisma.groupPlan.update({ where: { id: anyPlan.id }, data: { isActive: 1 } });
      }
    }

    await prisma.group.updateMany({
      where: { courseId: c.id, plan: null },
      data: { planId: plan.id },
    });

    const legacyMembers = await prisma.student.findMany({
      where: { courseId: c.id, groupId: { not: null } },
      select: { id: true, groupId: true },
    });
    for (const s of legacyMembers) {
      if (!s.groupId) continue;
      await prisma.groupMember
        .create({ data: { planId: plan.id, groupId: s.groupId, studentId: s.id } })
        .catch(() => {
          /* UNIQUE(plan_id, student_id) — already backfilled */
        });
    }
  }
}
