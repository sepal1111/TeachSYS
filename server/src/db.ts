// Prisma client bound to the runtime-resolved db file (see paths.ts), plus an
// idempotent schema bootstrap that mirrors app/database.py's init_db(): plain
// `CREATE TABLE IF NOT EXISTS` / best-effort `ALTER TABLE ADD COLUMN`, run on
// every startup. We deliberately do NOT use `prisma migrate` because the
// database file's location is only known at runtime (portable USB/bin dir).
import { PrismaClient } from "@prisma/client";
import { getDbPath } from "./paths";

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
  await prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL;");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      teacher_type TEXT NOT NULL DEFAULT 'homeroom',
      description TEXT,
      seat_rows INTEGER DEFAULT 5,
      seat_cols INTEGER DEFAULT 6,
      blackboard_position TEXT DEFAULT 'top',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS group_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS system_sessions (
      token TEXT PRIMARY KEY,
      created_date TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Column migrations for DBs created by older schema versions (safe no-op if already present).
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
  await tryAlter("ALTER TABLE qualitative_notes ADD COLUMN media_url TEXT NULL;");
  await tryAlter("ALTER TABLE qualitative_notes ADD COLUMN media_type TEXT NULL;");

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
