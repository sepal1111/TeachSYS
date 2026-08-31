import os
import re
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlite3 import Connection
from typing import Optional

from app.database import get_db, get_bin_dir
from app.models import QualitativeNoteCreate
from app.timezone import get_today_str_taipei, get_now_str_taipei

router = APIRouter(prefix="/api/notes", tags=["Qualitative Notes"])

def sanitize_filename_part(text: str) -> str:
    cleaned = re.sub(r'[\\/*?:"<>|]', '', text).replace(" ", "")
    return cleaned if cleaned else "課程"

from app.database import get_db, get_bin_dir

def build_media_filename(course_name: str, student_number: int, note_date_str: str, filename: str):
    clean_course = sanitize_filename_part(course_name)
    seat_str = f"{student_number:02d}"
    clean_date = note_date_str.replace("-", "")

    _, ext = os.path.splitext(filename)
    ext = ext.lower() if ext else ".jpg"

    base_name = f"{clean_course}-{seat_str}-{clean_date}"
    final_name = f"{base_name}{ext}"

    notes_dir = os.path.join(get_bin_dir(), "uploads", "notes")
    os.makedirs(notes_dir, exist_ok=True)

    target_path = os.path.join(notes_dir, final_name)
    idx = 1
    while os.path.exists(target_path):
        final_name = f"{base_name}_{idx}{ext}"
        target_path = os.path.join(notes_dir, final_name)
        idx += 1

    return final_name, target_path, ext

@router.get("/{course_id}")
def list_course_notes(
    course_id: int, 
    student_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Connection = Depends(get_db)
):
    cursor = db.cursor()
    query = """
        SELECT qn.*, s.student_number, s.name AS student_name, s.english_name AS student_english_name
        FROM qualitative_notes qn
        JOIN students s ON qn.student_id = s.id
        WHERE qn.course_id = ?
    """
    params = [course_id]

    if student_id:
        query += " AND qn.student_id = ?"
        params.append(student_id)
    if start_date:
        query += " AND qn.date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND qn.date <= ?"
        params.append(end_date)

    query += " ORDER BY qn.timestamp DESC"
    cursor.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]

@router.post("/{course_id}/with_media")
async def add_note_with_media(
    course_id: int,
    student_id: int = Form(...),
    note_text: Optional[str] = Form(None),
    date_str: Optional[str] = Form(None),
    media_file: Optional[UploadFile] = File(None),
    db: Connection = Depends(get_db)
):
    cursor = db.cursor()
    note_date = date_str or get_today_str_taipei()
    now_time = get_now_str_taipei()
    final_note_text = note_text.strip() if note_text and note_text.strip() else "【多媒體特殊表現紀錄】"

    # Fetch course and student info for naming
    cursor.execute("SELECT name FROM courses WHERE id = ?", (course_id,))
    c_row = cursor.fetchone()
    if not c_row:
        raise HTTPException(status_code=404, detail="Course not found")
    course_name = c_row["name"]

    cursor.execute("SELECT student_number FROM students WHERE id = ?", (student_id,))
    s_row = cursor.fetchone()
    if not s_row:
        raise HTTPException(status_code=404, detail="Student not found")
    student_number = s_row["student_number"]

    media_url = None
    media_type = None

    if media_file and media_file.filename:
        filename = media_file.filename
        saved_name, target_path, ext = build_media_filename(course_name, student_number, note_date, filename)

        contents = await media_file.read()
        with open(target_path, "wb") as f:
            f.write(contents)

        media_url = f"/uploads/notes/{saved_name}"

        img_exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        vid_exts = ['.mp4', '.mov', '.webm', '.avi', '.mkv']

        if ext in img_exts:
            media_type = "image"
        elif ext in vid_exts:
            media_type = "video"
        else:
            media_type = "image" if media_file.content_type and media_file.content_type.startswith("image/") else "video"

    cursor.execute("""
        INSERT INTO qualitative_notes (course_id, student_id, note_text, date, media_url, media_type, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (course_id, student_id, final_note_text, note_date, media_url, media_type, now_time))
    db.commit()

    return {
        "id": cursor.lastrowid, 
        "media_url": media_url, 
        "media_type": media_type,
        "message": "Note with media added successfully"
    }

@router.post("/{course_id}")
def add_note(course_id: int, data: QualitativeNoteCreate, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    note_date = data.date or get_today_str_taipei()
    now_time = get_now_str_taipei()

    cursor.execute("""
        INSERT INTO qualitative_notes (course_id, student_id, note_text, date, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (course_id, data.student_id, data.note_text, note_date, now_time))
    db.commit()

    return {"id": cursor.lastrowid, "message": "Note added successfully"}

@router.delete("/{course_id}/{note_id}")
def delete_note(course_id: int, note_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM qualitative_notes WHERE id = ? AND course_id = ?", (note_id, course_id))
    db.commit()
    return {"message": "Note deleted"}
