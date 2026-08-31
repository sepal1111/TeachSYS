import sqlite3
import os
import sys
import shutil
from typing import Generator

def get_exe_dir() -> str:
    """Returns absolute directory of the running executable binary or current script workspace."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.abspath(".")

def get_bin_dir() -> str:
    """Returns path to bin/ subfolder inside executable directory, creating it if needed."""
    bin_path = os.path.join(get_exe_dir(), "bin")
    os.makedirs(bin_path, exist_ok=True)
    return bin_path

def migrate_old_root_files():
    """Migrates any existing root classroom_record.db, photo/, uploads/ into bin/ subfolder if present."""
    exe_dir = get_exe_dir()
    bin_dir = get_bin_dir()

    # 1. Migrate classroom_record.db
    old_db = os.path.join(exe_dir, "classroom_record.db")
    new_db = os.path.join(bin_dir, "classroom_record.db")
    if os.path.exists(old_db) and not os.path.exists(new_db):
        try:
            shutil.move(old_db, new_db)
        except Exception:
            pass

    # 2. Migrate photo/ folder
    old_photo = os.path.join(exe_dir, "photo")
    new_photo = os.path.join(bin_dir, "photo")
    if os.path.exists(old_photo) and old_photo != new_photo:
        os.makedirs(new_photo, exist_ok=True)
        try:
            for item in os.listdir(old_photo):
                src = os.path.join(old_photo, item)
                dst = os.path.join(new_photo, item)
                if not os.path.exists(dst):
                    shutil.move(src, dst)
        except Exception:
            pass

    # 3. Migrate uploads/ folder
    old_uploads = os.path.join(exe_dir, "uploads")
    new_uploads = os.path.join(bin_dir, "uploads")
    if os.path.exists(old_uploads) and old_uploads != new_uploads:
        os.makedirs(new_uploads, exist_ok=True)
        try:
            for root, dirs, files in os.walk(old_uploads):
                rel_path = os.path.relpath(root, old_uploads)
                target_dir = os.path.join(new_uploads, rel_path)
                os.makedirs(target_dir, exist_ok=True)
                for f in files:
                    src_f = os.path.join(root, f)
                    dst_f = os.path.join(target_dir, f)
                    if not os.path.exists(dst_f):
                        shutil.move(src_f, dst_f)
        except Exception:
            pass

def get_db_path() -> str:
    if "CLASSROOM_DB_PATH" in os.environ:
        return os.environ["CLASSROOM_DB_PATH"]
    migrate_old_root_files()
    return os.path.join(get_bin_dir(), "classroom_record.db")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. 課程表 (courses)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        teacher_type TEXT NOT NULL DEFAULT 'homeroom',
        description TEXT,
        seat_rows INTEGER DEFAULT 5,
        seat_cols INTEGER DEFAULT 6,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. 小組表 (groups)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        group_name TEXT NOT NULL,
        icon_url TEXT NULL,
        order_index INTEGER DEFAULT 0,
        plan_id INTEGER NULL,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
    """)

    # 2.1 分組模式表 (group_plans)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
    """)

    # 2.2 小組成員關聯表 (group_members)
    cursor.execute("""
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
    """)

    # 3. 學生表 (students)
    cursor.execute("""
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
    """)

    # Column migration checks for existing SQLite DBs
    try:
        cursor.execute("ALTER TABLE groups ADD COLUMN icon_url TEXT NULL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE groups ADD COLUMN plan_id INTEGER NULL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE score_logs ADD COLUMN plan_id INTEGER NULL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE score_logs ADD COLUMN group_id INTEGER NULL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE courses ADD COLUMN seat_rows INTEGER DEFAULT 5;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE courses ADD COLUMN seat_cols INTEGER DEFAULT 6;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE courses ADD COLUMN blackboard_position TEXT DEFAULT 'top';")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN student_code TEXT NULL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN english_name TEXT NULL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN seat_row INTEGER NULL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN seat_col INTEGER NULL;")
    except Exception:
        pass

    # 4. 出缺席紀錄 (attendance)
    cursor.execute("""
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
    """)

    # 5. 評分規則 (evaluation_rules)
    cursor.execute("""
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
    """)

    # 6. 量化評分日誌 (score_logs)
    cursor.execute("""
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
    """)

    # 7. 質性文字與影音紀錄 (qualitative_notes)
    cursor.execute("""
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
    """)

    try:
        cursor.execute("ALTER TABLE qualitative_notes ADD COLUMN media_url TEXT NULL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE qualitative_notes ADD COLUMN media_type TEXT NULL;")
    except Exception:
        pass

    # 8. Undo 復原日誌 (undo_logs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS undo_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_undone INTEGER DEFAULT 0
    );
    """)

    # 9. 系統設定表 (system_settings)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)
    cursor.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('password_prefix', 'Admin');")
    cursor.execute("UPDATE system_settings SET value = 'Admin' WHERE key = 'password_prefix' AND value = 'kyps';")

    # 10. 登入會話表 (system_sessions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_sessions (
        token TEXT PRIMARY KEY,
        created_date TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # --- Auto-Migration: Ensure every course has an active group_plan and migrate legacy data ---
    try:
        cursor.execute("SELECT id FROM courses;")
        courses = cursor.fetchall()
        for c in courses:
            cid = c["id"]
            cursor.execute("SELECT id FROM group_plans WHERE course_id = ? AND is_active = 1 LIMIT 1;", (cid,))
            active_plan = cursor.fetchone()
            if not active_plan:
                cursor.execute("SELECT id FROM group_plans WHERE course_id = ? LIMIT 1;", (cid,))
                any_plan = cursor.fetchone()
                if not any_plan:
                    cursor.execute("INSERT INTO group_plans (course_id, name, is_active) VALUES (?, '常態分組', 1);", (cid,))
                    plan_id = cursor.lastrowid
                else:
                    plan_id = any_plan["id"]
                    cursor.execute("UPDATE group_plans SET is_active = 1 WHERE id = ?;", (plan_id,))
            else:
                plan_id = active_plan["id"]

            # Link legacy groups without plan_id to this plan
            cursor.execute("UPDATE groups SET plan_id = ? WHERE course_id = ? AND (plan_id IS NULL OR plan_id = 0);", (plan_id, cid))

            # Populate group_members from students table if empty for this plan
            cursor.execute("""
                INSERT OR IGNORE INTO group_members (plan_id, group_id, student_id)
                SELECT ?, s.group_id, s.id
                FROM students s
                JOIN groups g ON s.group_id = g.id
                WHERE s.course_id = ? AND s.group_id IS NOT NULL AND s.group_id > 0;
            """, (plan_id, cid))
    except Exception as e:
        print(f"[DB Auto-Migration Warning] {e}")

    conn.commit()
    conn.close()


def get_db():
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
