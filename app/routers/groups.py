import random
import math
import os
import time
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlite3 import Connection
from typing import List, Optional

from app.database import get_db, get_bin_dir
from app.models import (
    GroupingRequest, GroupDragUpdate, GroupCreate, GroupUpdate,
    GroupPlanCreate, GroupPlanUpdate
)
from app.ws_manager import manager

router = APIRouter(prefix="/api/groups", tags=["Groups"])

ANIMAL_ICONS = [
    "/static/pic/animals/penguin.png",
    "/static/pic/animals/rabbit.png",
    "/static/pic/animals/hedgehog.png",
    "/static/pic/animals/polar_bear.png",
    "/static/pic/animals/formosan_black_bear.png",
    "/static/pic/animals/elephant.png",
    "/static/pic/animals/guinea_pig.png",
    "/static/pic/animals/dog.png",
    "/static/pic/animals/squirrel.png",
    "/static/pic/animals/sika_deer.png",
    "/static/pic/animals/hippo.png",
    "/static/pic/animals/raccoon.png",
    "/static/pic/animals/sea_otter.png",
    "/static/pic/animals/dolphin.png",
    "/static/pic/animals/turtle.png",
    "/static/pic/animals/koala.png",
    "/static/pic/animals/panda.png",
    "/static/pic/animals/fox.png",
    "/static/pic/animals/lion.png",
    "/static/pic/animals/cheetah.png",
    "/static/pic/animals/tiger.png",
    "/static/pic/animals/snake.png",
    "/static/pic/animals/owl.png",
    "/static/pic/animals/giraffe.png",
    "/static/pic/animals/sparrow.png"
]

def get_or_create_active_plan(course_id: int, db: Connection, requested_plan_id: Optional[int] = None) -> dict:
    cursor = db.cursor()
    if isinstance(requested_plan_id, int):
        cursor.execute("SELECT * FROM group_plans WHERE id = ? AND course_id = ?", (requested_plan_id, course_id))
        plan = cursor.fetchone()
        if plan:
            return dict(plan)

    cursor.execute("SELECT * FROM group_plans WHERE course_id = ? AND is_active = 1 LIMIT 1", (course_id,))
    plan = cursor.fetchone()
    if plan:
        return dict(plan)

    cursor.execute("SELECT * FROM group_plans WHERE course_id = ? LIMIT 1", (course_id,))
    plan = cursor.fetchone()
    if plan:
        cursor.execute("UPDATE group_plans SET is_active = 1 WHERE id = ?", (plan["id"],))
        db.commit()
        return dict(plan)

    cursor.execute("INSERT INTO group_plans (course_id, name, is_active) VALUES (?, '常態分組', 1)", (course_id,))
    db.commit()
    new_id = cursor.lastrowid
    return {"id": new_id, "course_id": course_id, "name": "常態分組", "is_active": 1}

def sync_active_plan_to_students(course_id: int, plan_id: int, db: Connection):
    cursor = db.cursor()
    # Reset students.group_id for this course
    cursor.execute("UPDATE students SET group_id = NULL WHERE course_id = ?", (course_id,))
    # Sync from group_members of this plan
    cursor.execute("""
        UPDATE students
        SET group_id = (
            SELECT gm.group_id FROM group_members gm
            WHERE gm.plan_id = ? AND gm.student_id = students.id
        )
        WHERE course_id = ? AND id IN (
            SELECT student_id FROM group_members WHERE plan_id = ?
        )
    """, (plan_id, course_id, plan_id))
    db.commit()

@router.get("/{course_id}")
def get_course_groups(
    course_id: int, 
    plan_id: Optional[int] = Query(None),
    db: Connection = Depends(get_db)
):
    cursor = db.cursor()

    # 1. Fetch all plans for course
    cursor.execute("SELECT * FROM group_plans WHERE course_id = ? ORDER BY id ASC", (course_id,))
    plans = [dict(r) for r in cursor.fetchall()]

    current_plan = get_or_create_active_plan(course_id, db, plan_id)
    target_plan_id = current_plan["id"]

    # If plans was empty, re-fetch
    if not plans:
        cursor.execute("SELECT * FROM group_plans WHERE course_id = ? ORDER BY id ASC", (course_id,))
        plans = [dict(r) for r in cursor.fetchall()]

    # 2. Fetch groups for target plan
    cursor.execute("""
        SELECT * FROM groups WHERE course_id = ? AND plan_id = ? ORDER BY order_index ASC, id ASC
    """, (course_id, target_plan_id))
    groups = [dict(row) for row in cursor.fetchall()]

    # 3. For each group, fetch members via group_members
    for g in groups:
        cursor.execute("""
            SELECT s.id, s.student_number, s.student_code, s.name, s.english_name, s.gender, gm.group_id
            FROM group_members gm
            JOIN students s ON gm.student_id = s.id
            WHERE gm.plan_id = ? AND gm.group_id = ? AND s.course_id = ? AND s.is_active = 1
            ORDER BY s.student_number ASC
        """, (target_plan_id, g["id"], course_id))
        g["students"] = [dict(r) for r in cursor.fetchall()]

    # 4. Fetch unassigned active students for this plan
    cursor.execute("""
        SELECT s.id, s.student_number, s.student_code, s.name, s.english_name, s.gender, NULL AS group_id
        FROM students s
        WHERE s.course_id = ? AND s.is_active = 1
          AND s.id NOT IN (
              SELECT student_id FROM group_members WHERE plan_id = ? AND group_id IS NOT NULL AND group_id > 0
          )
        ORDER BY s.student_number ASC
    """, (course_id, target_plan_id))
    unassigned = [dict(r) for r in cursor.fetchall()]

    return {
        "plans": plans,
        "current_plan": current_plan,
        "groups": groups,
        "unassigned": unassigned
    }

# --- Group Plans Management APIs ---
@router.post("/{course_id}/plans")
async def create_group_plan(course_id: int, data: GroupPlanCreate, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    plan_name = data.name.strip() if data.name else "新分組模式"
    
    cursor.execute("INSERT INTO group_plans (course_id, name, is_active) VALUES (?, ?, 0)", (course_id, plan_name))
    new_plan_id = cursor.lastrowid

    # If copying from an existing plan
    if data.copy_from_plan_id:
        cursor.execute("SELECT * FROM groups WHERE course_id = ? AND plan_id = ? ORDER BY order_index ASC, id ASC", 
                       (course_id, data.copy_from_plan_id))
        source_groups = cursor.fetchall()
        
        group_id_map = {}
        for sg in source_groups:
            cursor.execute("""
                INSERT INTO groups (course_id, plan_id, group_name, icon_url, order_index)
                VALUES (?, ?, ?, ?, ?)
            """, (course_id, new_plan_id, sg["group_name"], sg["icon_url"], sg["order_index"]))
            group_id_map[sg["id"]] = cursor.lastrowid

        # Copy members
        cursor.execute("SELECT * FROM group_members WHERE plan_id = ?", (data.copy_from_plan_id,))
        source_members = cursor.fetchall()
        for sm in source_members:
            new_gid = group_id_map.get(sm["group_id"])
            if new_gid:
                cursor.execute("""
                    INSERT OR IGNORE INTO group_members (plan_id, group_id, student_id)
                    VALUES (?, ?, ?)
                """, (new_plan_id, new_gid, sm["student_id"]))

    db.commit()
    await manager.broadcast(course_id, "groups_updated")
    return {"id": new_plan_id, "name": plan_name, "message": f"分組模式「{plan_name}」建立成功！"}

@router.put("/{course_id}/plans/{plan_id}")
async def update_group_plan(course_id: int, plan_id: int, data: GroupPlanUpdate, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM group_plans WHERE id = ? AND course_id = ?", (plan_id, course_id))
    plan = cursor.fetchone()
    if not plan:
        raise HTTPException(status_code=404, detail="分組模式不存在")

    if data.name is not None:
        cursor.execute("UPDATE group_plans SET name = ? WHERE id = ? AND course_id = ?", (data.name.strip(), plan_id, course_id))

    if data.is_active is True:
        cursor.execute("UPDATE group_plans SET is_active = 0 WHERE course_id = ?", (course_id,))
        cursor.execute("UPDATE group_plans SET is_active = 1 WHERE id = ? AND course_id = ?", (plan_id, course_id))
        sync_active_plan_to_students(course_id, plan_id, db)

    db.commit()
    await manager.broadcast(course_id, "groups_updated")
    return {"message": "分組模式已更新！"}

@router.delete("/{course_id}/plans/{plan_id}")
async def delete_group_plan(course_id: int, plan_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM group_plans WHERE id = ? AND course_id = ?", (plan_id, course_id))
    plan = cursor.fetchone()
    if not plan:
        raise HTTPException(status_code=404, detail="分組模式不存在")

    cursor.execute("SELECT COUNT(*) as cnt FROM group_plans WHERE course_id = ?", (course_id,))
    total_plans = cursor.fetchone()["cnt"]
    if total_plans <= 1:
        raise HTTPException(status_code=400, detail="至少需保留一個分組模式，無法刪除最後一個模式！")

    was_active = bool(plan["is_active"])

    # Delete group members, groups, and plan
    cursor.execute("DELETE FROM group_members WHERE plan_id = ?", (plan_id,))
    cursor.execute("DELETE FROM groups WHERE course_id = ? AND plan_id = ?", (course_id, plan_id))
    cursor.execute("DELETE FROM group_plans WHERE id = ? AND course_id = ?", (plan_id, course_id))

    if was_active:
        # Activate the first remaining plan
        cursor.execute("SELECT id FROM group_plans WHERE course_id = ? ORDER BY id ASC LIMIT 1", (course_id,))
        first_plan = cursor.fetchone()
        if first_plan:
            cursor.execute("UPDATE group_plans SET is_active = 1 WHERE id = ?", (first_plan["id"],))
            sync_active_plan_to_students(course_id, first_plan["id"], db)

    db.commit()
    await manager.broadcast(course_id, "groups_updated")
    return {"message": f"分組模式「{plan['name']}」已刪除！"}

# --- Auto Grouping & Dragging ---
@router.post("/{course_id}/auto")
async def auto_grouping(course_id: int, data: GroupingRequest, db: Connection = Depends(get_db)):
    cursor = db.cursor()

    current_plan = get_or_create_active_plan(course_id, db, data.plan_id)
    target_plan_id = current_plan["id"]

    # 1. Fetch active students
    cursor.execute("""
        SELECT id, student_number, name, english_name, gender
        FROM students
        WHERE course_id = ? AND is_active = 1
    """, (course_id,))
    students = [dict(r) for r in cursor.fetchall()]

    if not students:
        raise HTTPException(status_code=400, detail="課程內尚無學生可供分組")

    if data.students_per_group and data.students_per_group >= 1:
        num_groups = math.ceil(len(students) / data.students_per_group)
    elif data.num_groups and data.num_groups >= 1:
        num_groups = data.num_groups
    else:
        num_groups = 6

    if num_groups < 1:
        raise HTTPException(status_code=400, detail="計算組數必須大於等於 1")

    # 2. Clear old groups and members for this plan
    cursor.execute("DELETE FROM group_members WHERE plan_id = ?", (target_plan_id,))
    cursor.execute("DELETE FROM groups WHERE course_id = ? AND plan_id = ?", (course_id, target_plan_id))
    
    # 3. Create N group records with non-repeating random animal icons
    shuffled_icons = list(ANIMAL_ICONS)
    random.shuffle(shuffled_icons)

    group_ids = []
    for i in range(1, num_groups + 1):
        icon_url = shuffled_icons[(i - 1) % len(shuffled_icons)]
        cursor.execute("""
            INSERT INTO groups (course_id, plan_id, group_name, icon_url, order_index)
            VALUES (?, ?, ?, ?, ?)
        """, (course_id, target_plan_id, f"第 {i} 組", icon_url, i))
        group_ids.append(cursor.lastrowid)

    # 4. Grouping Algorithm
    if data.mode == "gender_balanced":
        males = [s for s in students if s["gender"] == "M"]
        females = [s for s in students if s["gender"] == "F"]
        others = [s for s in students if s["gender"] not in ["M", "F"]]

        random.shuffle(males)
        random.shuffle(females)
        random.shuffle(others)

        # Distribute males round-robin
        for idx, m in enumerate(males):
            target_g = group_ids[idx % num_groups]
            cursor.execute("INSERT INTO group_members (plan_id, group_id, student_id) VALUES (?, ?, ?)",
                           (target_plan_id, target_g, m["id"]))

        # Distribute females round-robin (offset for balance)
        for idx, f in enumerate(females):
            target_g = group_ids[(idx + 1) % num_groups]
            cursor.execute("INSERT INTO group_members (plan_id, group_id, student_id) VALUES (?, ?, ?)",
                           (target_plan_id, target_g, f["id"]))

        for idx, o in enumerate(others):
            target_g = group_ids[idx % num_groups]
            cursor.execute("INSERT INTO group_members (plan_id, group_id, student_id) VALUES (?, ?, ?)",
                           (target_plan_id, target_g, o["id"]))
    else:
        # Complete random
        random.shuffle(students)
        for idx, s in enumerate(students):
            target_g = group_ids[idx % num_groups]
            cursor.execute("INSERT INTO group_members (plan_id, group_id, student_id) VALUES (?, ?, ?)",
                           (target_plan_id, target_g, s["id"]))

    if current_plan.get("is_active"):
        sync_active_plan_to_students(course_id, target_plan_id, db)

    db.commit()
    await manager.broadcast(course_id, "groups_updated")
    return get_course_groups(course_id, target_plan_id, db)

@router.put("/{course_id}/drag")
async def drag_update_student_group(course_id: int, data: GroupDragUpdate, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    current_plan = get_or_create_active_plan(course_id, db, data.plan_id)
    target_plan_id = current_plan["id"]

    if data.group_id is None or data.group_id == 0:
        cursor.execute("DELETE FROM group_members WHERE plan_id = ? AND student_id = ?", (target_plan_id, data.student_id))
    else:
        cursor.execute("""
            INSERT INTO group_members (plan_id, group_id, student_id)
            VALUES (?, ?, ?)
            ON CONFLICT(plan_id, student_id) DO UPDATE SET group_id = excluded.group_id
        """, (target_plan_id, data.group_id, data.student_id))

    if current_plan.get("is_active"):
        sync_active_plan_to_students(course_id, target_plan_id, db)

    db.commit()
    await manager.broadcast(course_id, "groups_updated")
    return {"message": "Group updated successfully"}

@router.post("/{course_id}")
async def create_group(course_id: int, data: GroupCreate, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    current_plan = get_or_create_active_plan(course_id, db, data.plan_id)
    target_plan_id = current_plan["id"]

    cursor.execute("SELECT MAX(order_index) as max_order FROM groups WHERE course_id = ? AND plan_id = ?", (course_id, target_plan_id))
    row = cursor.fetchone()
    max_order = (row["max_order"] or 0) + 1 if row else 1
    order = data.order_index if data.order_index else max_order
    
    icon_url = data.icon_url
    if not icon_url:
        cursor.execute("SELECT icon_url FROM groups WHERE course_id = ? AND plan_id = ?", (course_id, target_plan_id))
        used_icons = set(r[0] for r in cursor.fetchall() if r[0])
        unused = [url for url in ANIMAL_ICONS if url not in used_icons]
        if unused:
            icon_url = random.choice(unused)
        else:
            icon_url = random.choice(ANIMAL_ICONS)

    cursor.execute("""
        INSERT INTO groups (course_id, plan_id, group_name, icon_url, order_index)
        VALUES (?, ?, ?, ?, ?)
    """, (course_id, target_plan_id, data.group_name.strip(), icon_url, order))
    db.commit()
    await manager.broadcast(course_id, "groups_updated")
    return {"id": cursor.lastrowid, "message": f"小組「{data.group_name}」建立成功！"}

@router.put("/{course_id}/{group_id}")
async def update_group(course_id: int, group_id: int, data: GroupUpdate, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM groups WHERE id = ? AND course_id = ?", (group_id, course_id))
    group = cursor.fetchone()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    updates = []
    params = []
    if data.group_name is not None:
        updates.append("group_name = ?")
        params.append(data.group_name.strip())
    if data.icon_url is not None:
        updates.append("icon_url = ?")
        params.append(data.icon_url)
    if data.order_index is not None:
        updates.append("order_index = ?")
        params.append(data.order_index)
    
    if updates:
        params.extend([group_id, course_id])
        cursor.execute(f"UPDATE groups SET {', '.join(updates)} WHERE id = ? AND course_id = ?", params)
        db.commit()
        await manager.broadcast(course_id, "groups_updated")
    return {"message": "小組資料更新成功！"}

@router.post("/{course_id}/{group_id}/upload_icon")
async def upload_group_icon(
    course_id: int,
    group_id: int,
    file: UploadFile = File(...),
    db: Connection = Depends(get_db)
):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM groups WHERE id = ? AND course_id = ?", (group_id, course_id))
    group = cursor.fetchone()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="請選擇要上傳的圖檔")
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']:
        raise HTTPException(status_code=400, detail="僅支援 JPG、PNG、GIF、WEBP 或 SVG 格式圖檔")
    
    bin_dir = get_bin_dir()
    groups_dir = os.path.join(bin_dir, "uploads", "groups")
    os.makedirs(groups_dir, exist_ok=True)
    
    timestamp = int(time.time() * 1000)
    filename = f"group_{course_id}_{group_id}_{timestamp}{ext}"
    target_path = os.path.join(groups_dir, filename)
    
    contents = await file.read()
    with open(target_path, "wb") as f:
        f.write(contents)
    
    icon_url = f"/uploads/groups/{filename}"
    cursor.execute("UPDATE groups SET icon_url = ? WHERE id = ? AND course_id = ?", (icon_url, group_id, course_id))
    db.commit()
    await manager.broadcast(course_id, "groups_updated")

    return {"message": "小組圖示上傳成功！", "icon_url": icon_url}

@router.delete("/{course_id}/{group_id}/icon")
async def reset_group_icon(course_id: int, group_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("UPDATE groups SET icon_url = NULL WHERE id = ? AND course_id = ?", (group_id, course_id))
    db.commit()
    await manager.broadcast(course_id, "groups_updated")
    return {"message": "小組圖示已恢復預設！"}

@router.delete("/{course_id}/{group_id}")
async def delete_group(course_id: int, group_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT plan_id FROM groups WHERE id = ? AND course_id = ?", (group_id, course_id))
    row = cursor.fetchone()
    plan_id = row["plan_id"] if row else None

    cursor.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
    cursor.execute("DELETE FROM groups WHERE id = ? AND course_id = ?", (group_id, course_id))

    if plan_id:
        cursor.execute("SELECT is_active FROM group_plans WHERE id = ?", (plan_id,))
        p_row = cursor.fetchone()
        if p_row and p_row["is_active"]:
            sync_active_plan_to_students(course_id, plan_id, db)

    db.commit()
    await manager.broadcast(course_id, "groups_updated")
    return {"message": "小組已刪除，組內成員已移至未分組！"}

