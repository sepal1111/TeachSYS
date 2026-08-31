import random
from fastapi import APIRouter, Depends, HTTPException
from sqlite3 import Connection
from typing import List, Optional

from app.database import get_db
from app.models import SeatingConfigRequest, SeatingArrangeRequest, SeatDragUpdate

router = APIRouter(prefix="/api/seating", tags=["Seating Chart"])

@router.get("/{course_id}")
def get_seating_chart(course_id: int, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT seat_rows, seat_cols, blackboard_position FROM courses WHERE id = ?", (course_id,))
    c_row = cursor.fetchone()
    if not c_row:
        raise HTTPException(status_code=404, detail="Course not found")
    
    rows = c_row["seat_rows"] or 5
    cols = c_row["seat_cols"] or 6
    bb_pos = c_row["blackboard_position"] or "top"

    # Fetch active students
    cursor.execute("""
        SELECT id, student_number, student_code, name, english_name, gender, seat_row, seat_col
        FROM students
        WHERE course_id = ? AND is_active = 1
        ORDER BY student_number ASC
    """, (course_id,))
    students = [dict(r) for r in cursor.fetchall()]

    # Build grid map: (row, col) -> student
    grid_map = {}
    unassigned = []
    for s in students:
        r = s["seat_row"]
        c = s["seat_col"]
        if r is not None and c is not None and 1 <= r <= rows and 1 <= c <= cols:
            grid_map[(r, c)] = s
        else:
            unassigned.append(s)

    # Construct full grid array
    grid = []
    for r in range(1, rows + 1):
        row_cells = []
        for c in range(1, cols + 1):
            row_cells.append({
                "row": r,
                "col": c,
                "student": grid_map.get((r, c), None)
            })
        grid.append(row_cells)

    return {
        "seat_rows": rows,
        "seat_cols": cols,
        "blackboard_position": bb_pos,
        "grid": grid,
        "unassigned": unassigned
    }

@router.post("/{course_id}/config")
def update_seating_config(course_id: int, data: SeatingConfigRequest, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    bb_pos = data.blackboard_position if data.blackboard_position in ["top", "bottom", "left", "right"] else "top"
    cursor.execute("""
        UPDATE courses SET seat_rows = ?, seat_cols = ?, blackboard_position = ? WHERE id = ?
    """, (data.seat_rows, data.seat_cols, bb_pos, course_id))
    db.commit()
    return {"message": "Seating config updated successfully"}

@router.post("/{course_id}/auto")
def auto_arrange_seats(course_id: int, data: SeatingArrangeRequest, db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT seat_rows, seat_cols FROM courses WHERE id = ?", (course_id,))
    c_row = cursor.fetchone()
    if not c_row:
        raise HTTPException(status_code=404, detail="Course not found")
    
    rows = c_row["seat_rows"] or 5
    cols = c_row["seat_cols"] or 6
    total_seats = rows * cols

    cursor.execute("""
        SELECT id, student_number, name, english_name, gender
        FROM students
        WHERE course_id = ? AND is_active = 1
    """, (course_id,))
    students = [dict(r) for r in cursor.fetchall()]

    # Clear current seating
    cursor.execute("UPDATE students SET seat_row = NULL, seat_col = NULL WHERE course_id = ?", (course_id,))

    # Generate all seat coordinates (1,1) to (rows, cols)
    available_seats = [(r, c) for r in range(1, rows + 1) for c in range(1, cols + 1)]

    if data.mode == "by_number":
        # Arrange sequentially by student_number ASC
        students.sort(key=lambda s: s["student_number"])
        for idx, s in enumerate(students):
            if idx < len(available_seats):
                seat = available_seats[idx]
                cursor.execute("UPDATE students SET seat_row = ?, seat_col = ? WHERE id = ?", (seat[0], seat[1], s["id"]))

    elif data.mode == "gender_balanced":
        males = [s for s in students if s["gender"] == "M"]
        females = [s for s in students if s["gender"] == "F"]
        others = [s for s in students if s["gender"] not in ["M", "F"]]

        random.shuffle(males)
        random.shuffle(females)
        random.shuffle(others)

        # Build alternating sequence: 男, 女, 男, 女, 男, 女...
        alternating_list = []
        m_idx, f_idx = 0, 0
        turn_male = True

        total_students_count = len(students)
        for _ in range(total_students_count):
            if turn_male:
                if m_idx < len(males):
                    alternating_list.append(males[m_idx])
                    m_idx += 1
                elif f_idx < len(females):
                    alternating_list.append(females[f_idx])
                    f_idx += 1
                elif others:
                    alternating_list.append(others.pop(0))
            else:
                if f_idx < len(females):
                    alternating_list.append(females[f_idx])
                    f_idx += 1
                elif m_idx < len(males):
                    alternating_list.append(males[m_idx])
                    m_idx += 1
                elif others:
                    alternating_list.append(others.pop(0))
            turn_male = not turn_male

        # Assign into grid seats from left to right, top to bottom: (1,1), (1,2)... (2,1), (2,2)...
        for idx, s in enumerate(alternating_list):
            if idx < len(available_seats):
                seat = available_seats[idx]
                cursor.execute("UPDATE students SET seat_row = ?, seat_col = ? WHERE id = ?", (seat[0], seat[1], s["id"]))

    else:
        # Complete Random
        random.shuffle(students)
        for idx, s in enumerate(students):
            if idx < len(available_seats):
                seat = available_seats[idx]
                cursor.execute("UPDATE students SET seat_row = ?, seat_col = ? WHERE id = ?", (seat[0], seat[1], s["id"]))

    db.commit()
    return get_seating_chart(course_id, db)

@router.put("/{course_id}/drag")
def drag_update_seat(course_id: int, data: SeatDragUpdate, db: Connection = Depends(get_db)):
    cursor = db.cursor()

    # Check if target seat is occupied by another student
    cursor.execute("""
        SELECT id, seat_row, seat_col FROM students
        WHERE course_id = ? AND seat_row = ? AND seat_col = ? AND id != ?
    """, (course_id, data.target_row, data.target_col, data.student_id))
    target_student = cursor.fetchone()

    # Get source student current seat
    cursor.execute("SELECT id, seat_row, seat_col FROM students WHERE id = ? AND course_id = ?", (data.student_id, course_id))
    source_student = cursor.fetchone()
    if not source_student:
        raise HTTPException(status_code=404, detail="Student not found")

    source_row = source_student["seat_row"]
    source_col = source_student["seat_col"]

    if target_student:
        # Swap seats!
        cursor.execute("UPDATE students SET seat_row = ?, seat_col = ? WHERE id = ?", (source_row, source_col, target_student["id"]))

    # Move source student to target seat
    cursor.execute("UPDATE students SET seat_row = ?, seat_col = ? WHERE id = ?", (data.target_row, data.target_col, data.student_id))

    db.commit()
    return {"message": "Seat updated successfully"}
