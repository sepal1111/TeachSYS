import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlite3 import Connection
from typing import Optional

from app.database import get_db
from app.models import AttendanceBatchUpdate

from app.timezone import get_today_str_taipei, get_now_str_taipei
from app.ws_manager import manager

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

@router.get("/{course_id}")
def get_attendance(
    course_id: int, 
    target_date: Optional[str] = Query(None, alias="date"), 
    db: Connection = Depends(get_db)
):
    if not target_date:
        target_date = get_today_str_taipei()

    cursor = db.cursor()
    cursor.execute("""
        SELECT s.id AS student_id, s.student_number, s.student_code, s.name, s.english_name, s.gender,
               COALESCE(a.status, 'present') AS status,
               a.id AS attendance_id
        FROM students s
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
        WHERE s.course_id = ? AND s.is_active = 1
        ORDER BY s.student_number ASC
    """, (target_date, course_id))

    records = [dict(row) for row in cursor.fetchall()]
    return {
        "date": target_date,
        "records": records
    }

@router.post("/{course_id}")
async def batch_update_attendance(
    course_id: int,
    data: AttendanceBatchUpdate,
    db: Connection = Depends(get_db)
):
    cursor = db.cursor()
    target_date = data.date
    now_time = get_now_str_taipei()
    
    # Preserve current state for Undo
    cursor.execute("""
        SELECT student_id, status FROM attendance WHERE course_id = ? AND date = ?
    """, (course_id, target_date))
    old_records = [dict(row) for row in cursor.fetchall()]

    for item in data.items:
        cursor.execute("""
            INSERT INTO attendance (course_id, student_id, date, status, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(course_id, student_id, date) DO UPDATE SET
                status = excluded.status,
                updated_at = excluded.updated_at
        """, (course_id, item.student_id, target_date, item.status, now_time))

    # Save Undo log
    undo_payload = json.dumps({
        "course_id": course_id,
        "date": target_date,
        "old_records": old_records
    }, ensure_ascii=False)

    cursor.execute("""
        INSERT INTO undo_logs (action_type, target_id, payload_json, created_at)
        VALUES ('attendance', ?, ?, ?)
    """, (course_id, undo_payload, now_time))
    undo_id = cursor.lastrowid

    db.commit()
    await manager.broadcast(course_id, "attendance_updated")
    return {"message": "Attendance updated successfully", "undo_id": undo_id}
