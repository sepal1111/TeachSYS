import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlite3 import Connection
from typing import List, Optional

from app.database import get_db
from app.models import ScoreAddRequest, EvaluationRuleCreate, UndoRequest
from app.timezone import get_today_str_taipei, get_now_str_taipei
from app.ws_manager import manager

router = APIRouter(prefix="/api/scores", tags=["Scores"])

@router.get("/{course_id}/rules")
def list_rules(course_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        SELECT * FROM evaluation_rules WHERE course_id = ? ORDER BY category DESC, id ASC
    """, (course_id,))
    return [dict(row) for row in cursor.fetchall()]

@router.post("/{course_id}/rules")
def create_rule(course_id: int, data: EvaluationRuleCreate, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO evaluation_rules (course_id, title, category, score_value, icon)
        VALUES (?, ?, ?, ?, ?)
    """, (course_id, data.title, data.category, data.score_value, data.icon))
    db.commit()
    return {"id": cursor.lastrowid, "message": "Rule created"}

DEFAULT_RULES = [
    {"title": "熱心助人", "category": "positive", "score_value": 1, "icon": "🤝"},
    {"title": "發言踴躍", "category": "positive", "score_value": 1, "icon": "🙋‍♂️"},
    {"title": "專心聽講", "category": "positive", "score_value": 1, "icon": "👂"},
    {"title": "作業優良", "category": "positive", "score_value": 2, "icon": "📝"},
    {"title": "團隊合作", "category": "positive", "score_value": 1, "icon": "🌟"},
    {"title": "上課吵鬧", "category": "negative", "score_value": -1, "icon": "📢"},
    {"title": "未帶用品", "category": "negative", "score_value": -1, "icon": "🎒"},
    {"title": "上課分心", "category": "negative", "score_value": -1, "icon": "😴"},
]

@router.put("/{course_id}/rules/{rule_id}")
def update_rule(course_id: int, rule_id: int, data: EvaluationRuleCreate, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        UPDATE evaluation_rules
        SET title = ?, category = ?, score_value = ?, icon = ?
        WHERE id = ? AND course_id = ?
    """, (data.title, data.category, data.score_value, data.icon, rule_id, course_id))
    db.commit()
    return {"message": "Rule updated"}

@router.post("/{course_id}/rules/reset_defaults")
def reset_default_rules(course_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM evaluation_rules WHERE course_id = ?", (course_id,))
    for rule in DEFAULT_RULES:
        cursor.execute("""
            INSERT INTO evaluation_rules (course_id, title, category, score_value, icon)
            VALUES (?, ?, ?, ?, ?)
        """, (course_id, rule["title"], rule["category"], rule["score_value"], rule["icon"]))
    db.commit()
    return {"message": "Default rules restored"}

@router.post("/{course_id}/add")
async def add_scores(course_id: int, data: ScoreAddRequest, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    score_date = data.date or get_today_str_taipei()
    now_timestamp = get_now_str_taipei()

    # Resolve target_plan_id
    target_plan_id = data.plan_id
    if target_plan_id is None and data.group_id is not None:
        cursor.execute("SELECT plan_id FROM groups WHERE id = ?", (data.group_id,))
        grow = cursor.fetchone()
        if grow and grow["plan_id"]:
            target_plan_id = grow["plan_id"]
        else:
            cursor.execute("SELECT id FROM group_plans WHERE course_id = ? AND is_active = 1", (course_id,))
            prow = cursor.fetchone()
            if prow:
                target_plan_id = prow["id"]

    inserted_score_ids = []
    for sid in data.student_ids:
        cursor.execute("""
            INSERT INTO score_logs (course_id, student_id, rule_id, rule_title, score, category, date, timestamp, plan_id, group_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (course_id, sid, data.rule_id, data.rule_title, data.score, data.category, score_date, now_timestamp, target_plan_id, data.group_id))
        inserted_score_ids.append(cursor.lastrowid)

    # Save Undo Log
    undo_payload = json.dumps({
        "score_log_ids": inserted_score_ids,
        "course_id": course_id,
        "score": data.score,
        "rule_title": data.rule_title,
        "count": len(data.student_ids)
    }, ensure_ascii=False)

    cursor.execute("""
        INSERT INTO undo_logs (action_type, target_id, payload_json, created_at)
        VALUES ('score', ?, ?, ?)
    """, (course_id, undo_payload, now_timestamp))
    undo_id = cursor.lastrowid

    db.commit()
    await manager.broadcast(course_id, "score_updated")
    return {
        "message": f"Successfully applied {data.score} points ({data.rule_title}) to {len(data.student_ids)} students",
        "undo_id": undo_id
    }

@router.post("/undo")
async def execute_undo(data: UndoRequest, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM undo_logs WHERE id = ? AND is_undone = 0", (data.undo_id,))
    undo_entry = cursor.fetchone()
    if not undo_entry:
        raise HTTPException(status_code=404, detail="Undo record not found or already undone")

    undo_entry = dict(undo_entry)
    payload = json.loads(undo_entry["payload_json"])

    if undo_entry["action_type"] == "score":
        score_log_ids = payload.get("score_log_ids", [])
        if score_log_ids:
            placeholders = ",".join(["?"] * len(score_log_ids))
            cursor.execute(f"UPDATE score_logs SET is_undone = 1 WHERE id IN ({placeholders})", score_log_ids)

    elif undo_entry["action_type"] == "attendance":
        course_id = payload["course_id"]
        target_date = payload["date"]
        old_records = payload.get("old_records", [])

        # Reset attendance records for that course & date to old state
        cursor.execute("DELETE FROM attendance WHERE course_id = ? AND date = ?", (course_id, target_date))
        for rec in old_records:
            cursor.execute("""
                INSERT INTO attendance (course_id, student_id, date, status)
                VALUES (?, ?, ?, ?)
            """, (course_id, rec["student_id"], target_date, rec["status"]))

    # Mark undo log as undone
    cursor.execute("UPDATE undo_logs SET is_undone = 1 WHERE id = ?", (data.undo_id,))
    db.commit()

    await manager.broadcast(payload["course_id"], "score_updated")
    return {"message": "Undo executed successfully"}

@router.get("/{course_id}/student/{student_id}/logs")
def get_student_score_logs(
    course_id: int,
    student_id: int,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_undone: bool = Query(True),
    db: Connection = Depends(get_db)
):
    cursor = db.cursor()
    query = """
        SELECT sl.id, sl.course_id, sl.student_id, sl.rule_id, sl.rule_title, sl.score, sl.category, sl.date, sl.timestamp,
               sl.is_undone, sl.plan_id, sl.group_id,
               gp.name AS plan_name,
               g.group_name
        FROM score_logs sl
        LEFT JOIN group_plans gp ON sl.plan_id = gp.id
        LEFT JOIN groups g ON sl.group_id = g.id
        WHERE sl.course_id = ? AND sl.student_id = ?
    """
    params = [course_id, student_id]
    if not include_undone or include_undone is False:
        query += " AND sl.is_undone = 0"
    if isinstance(start_date, str) and start_date:
        query += " AND sl.date >= ?"
        params.append(start_date)
    if isinstance(end_date, str) and end_date:
        query += " AND sl.date <= ?"
        params.append(end_date)
    query += " ORDER BY sl.timestamp DESC, sl.id DESC"

    cursor.execute(query, params)
    logs = [dict(row) for row in cursor.fetchall()]

    active_logs = [l for l in logs if l.get("is_undone") == 0]
    pos_sum = sum(l["score"] for l in active_logs if l["score"] > 0)
    neg_sum = sum(l["score"] for l in active_logs if l["score"] < 0)
    total_score = sum(l["score"] for l in active_logs)

    return {
        "student_id": student_id,
        "total_score": total_score,
        "positive_score": pos_sum,
        "negative_score": neg_sum,
        "logs": logs
    }

@router.delete("/{course_id}/logs/{log_id}")
async def delete_score_log(course_id: int, log_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        UPDATE score_logs SET is_undone = 1 WHERE id = ? AND course_id = ?
    """, (log_id, course_id))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Score log not found")
    db.commit()
    await manager.broadcast(course_id, "score_updated")
    return {"message": "Score record deleted successfully"}

@router.post("/{course_id}/logs/{log_id}/restore")
async def restore_score_log(course_id: int, log_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        UPDATE score_logs SET is_undone = 0 WHERE id = ? AND course_id = ?
    """, (log_id, course_id))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Score log not found")
    db.commit()
    await manager.broadcast(course_id, "score_updated")
    return {"message": "Score record restored successfully"}

