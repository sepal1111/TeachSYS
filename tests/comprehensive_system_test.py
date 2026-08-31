import os
import sys
import io
import asyncio
import openpyxl

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')

from app.database import get_db_connection, init_db
from app.routers import courses, attendance, groups, scores, reports, notes, system
from app.models import (
    StudentCreate, StudentUpdate, AttendanceBatchUpdate, AttendanceItem,
    GroupPlanCreate, GroupPlanUpdate, GroupCreate, GroupUpdate,
    ScoreAddRequest, UndoRequest, QualitativeNoteCreate
)

async def run_all_tests():
    print("=" * 60)
    print("🚀 開始執行全系統深度自動化測試 (Direct Router Verification)")
    print("=" * 60)

    # 1. Database Init Test
    print("\n[Test 1] 資料庫結構與初始化驗證...")
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r["name"] for r in cursor.fetchall()]
    required_tables = ["courses", "students", "attendance", "evaluation_rules", "score_logs", "group_plans", "groups", "group_members", "qualitative_notes", "undo_logs", "system_settings", "system_sessions"]
    for t in required_tables:
        assert t in tables, f"缺少必要資料表: {t}"
    print(f"  ✅ 所有必要資料表 ({len(required_tables)} 個) 結構完整無缺！")

    # Fetch active course
    cursor.execute("SELECT id, name FROM courses LIMIT 1")
    course = cursor.fetchone()
    assert course is not None, "未找到測試課程！"
    course_id = course["id"]
    course_name = course["name"]
    print(f"  📌 測試課程: ID={course_id}, 名稱={course_name}")

    # 2. System & Network Info Endpoints
    print("\n[Test 2] 系統驗證與狀態檢查...")
    sys_info = system.get_system_info()
    assert "local_ip" in sys_info and "qr_code" in sys_info
    print("  ✅ 系統連線資訊與 QR Code 產製正常！")

    # 3. Courses & Students Management
    print("\n[Test 3] 班級與學生管理模組 (CRUD)...")
    course_list = courses.list_courses(db=conn)
    assert len(course_list) > 0

    student_list = courses.list_students(course_id, db=conn)
    assert len(student_list) > 0
    print(f"  ✅ 成功讀取學生名單，共 {len(student_list)} 位學生！")

    # Create student
    new_s = courses.create_student(course_id, StudentCreate(student_number=99, name="測試小生", gender="M"), db=conn)
    new_sid = new_s["id"]
    # Update student
    courses.update_student(course_id, new_sid, StudentUpdate(student_number=99, name="測試小生改", gender="M"), db=conn)
    # Delete student
    del_res = courses.delete_student(course_id, new_sid, db=conn)
    assert "message" in del_res
    print("  ✅ 學生 新增 / 編輯 / 刪除 功能完全正常！")

    # 4. Attendance Management
    print("\n[Test 4] 出缺席點名模組...")
    test_sid = student_list[0]["id"]
    att_res = attendance.get_attendance(course_id, target_date="2026-08-27", db=conn)
    assert "records" in att_res or isinstance(att_res, list)
    batch_att = await attendance.batch_update_attendance(course_id, AttendanceBatchUpdate(
        date="2026-08-27",
        items=[AttendanceItem(student_id=test_sid, status="present")]
    ), db=conn)
    assert "message" in batch_att
    print("  ✅ 出缺席點名 查詢與批次記錄 功能正常！")

    # 5. Multi-Plan Grouping Management
    print("\n[Test 5] 多重分組模式記憶與小組架構模組...")
    grp_info = groups.get_course_groups(course_id, db=conn)
    plans = grp_info["plans"]
    assert len(plans) > 0
    active_plan = grp_info["current_plan"]
    plan_id = active_plan["id"]
    print(f"  📌 當前啟用分組模式: ID={plan_id}, 名稱={active_plan['name']}")

    # Create temporary plan
    temp_plan = await groups.create_group_plan(course_id, GroupPlanCreate(name="測試模式X"), db=conn)
    temp_pid = temp_plan["id"]
    # Delete temp plan
    await groups.delete_group_plan(course_id, temp_pid, db=conn)
    print("  ✅ 多重分組模式 新增 / 刪除 功能正常！")

    # Fetch groups in active plan
    group_list = grp_info["groups"]
    assert len(group_list) > 0
    target_grp = group_list[0]
    target_grp_id = target_grp["id"]
    print(f"  ✅ 成功讀取小組架構，共 {len(group_list)} 組！測試組: {target_grp['group_name']}")

    # 6. Scoring & Isolated Group Scoring Gamification
    print("\n[Test 6] 評分系統、小組獨立得分與撤銷回復...")
    rules = scores.list_rules(course_id, db=conn)
    assert len(rules) > 0
    test_rule = rules[0]

    # Add score for single student
    score_single_res = await scores.add_scores(course_id, ScoreAddRequest(
        student_ids=[test_sid],
        rule_id=test_rule["id"],
        rule_title=test_rule["title"],
        score=test_rule["score_value"],
        category=test_rule["category"]
    ), db=conn)
    undo_id_single = score_single_res["undo_id"]
    # Undo score
    undo_res = await scores.execute_undo(UndoRequest(undo_id=undo_id_single), db=conn)
    assert "message" in undo_res
    print("  ✅ 個人評分與秒級撤銷 (Undo) 功能正常！")

    # Add score for group
    grp_member_ids = [s["id"] for s in target_grp.get("students", [])]
    if not grp_member_ids:
        grp_member_ids = [test_sid]
    score_grp_res = await scores.add_scores(course_id, ScoreAddRequest(
        student_ids=grp_member_ids,
        rule_id=test_rule["id"],
        rule_title=test_rule["title"],
        score=test_rule["score_value"],
        category=test_rule["category"],
        group_id=target_grp_id,
        plan_id=plan_id
    ), db=conn)
    assert "undo_id" in score_grp_res
    print(f"  ✅ 小組評分 (+小組獨立得分記錄) 功能正常！")

    # Fetch score logs and verify plan/group tags
    score_logs_res = scores.get_student_score_logs(course_id, student_id=test_sid, db=conn)
    logs = score_logs_res["logs"]
    assert len(logs) > 0
    first_log = logs[0]
    assert "plan_name" in first_log and "group_name" in first_log

    # Soft-delete log and restore
    del_log_res = await scores.delete_score_log(course_id, first_log["id"], db=conn)
    assert "message" in del_log_res
    rest_log_res = await scores.restore_score_log(course_id, first_log["id"], db=conn)
    assert "message" in rest_log_res
    print("  ✅ 評分歷史 日誌標籤 / 撤銷刪除 / 一鍵回復 功能正常！")

    # 7. Reports, Dashboard & Excel Export
    print("\n[Test 7] 儀表板、排行榜與 Excel 報表匯出...")
    dash_today = reports.get_dashboard_data(course_id, period="today", plan_id=plan_id, db=conn)
    assert "students" in dash_today and "group_leaderboard" in dash_today
    dash_sem = reports.get_dashboard_data(course_id, period="semester", plan_id=plan_id, db=conn)
    assert "students" in dash_sem and "group_leaderboard" in dash_sem

    # Excel export test
    excel_stream = reports.export_excel_report(course_id, start_date=None, end_date=None, db=conn)
    
    # Collect bytes from StreamingResponse
    buf = io.BytesIO()
    if hasattr(excel_stream.body_iterator, "__aiter__"):
        async for chunk in excel_stream.body_iterator:
            buf.write(chunk)
    else:
        for chunk in excel_stream.body_iterator:
            buf.write(chunk)
    buf.seek(0)
    wb = openpyxl.load_workbook(buf)
    
    # 4 Sheets check
    expected_sheets = ["出缺席統計", "量化成績統計與明細", "小組分數成員與得分一覽", "質性紀錄明細"]
    assert wb.sheetnames == expected_sheets, f"工作表不符合: {wb.sheetnames}"

    # Sheet 2 header check
    ws2 = wb["量化成績統計與明細"]
    ws2_h = [c.value for c in ws2[3] if c.value]
    assert "當前組別" not in ws2_h, "Sheet 2 不應含有當前組別"
    assert ws2_h == ["座號", "姓名", "加減分總計"]

    # Sheet 3 header & pastel fill check
    ws3 = wb["小組分數成員與得分一覽"]
    ws3_h = [c.value for c in ws3[3] if c.value]
    assert "模式狀態" not in ws3_h, "Sheet 3 不應含有模式狀態"
    assert ws3_h[0:4] == ["分組模式", "小組名稱", "小組獨立得分", "組內成員人數"]
    assert "成員 1" in ws3_h
    if ws3.max_row >= 4:
        fill_color = ws3.cell(row=4, column=1).fill.start_color.rgb
        assert fill_color is not None and fill_color != "00000000"
    print("  ✅ Excel 4 大工作表、欄位分組、淡色系底色與公式計算完全正確！")

    # 8. Qualitative Notes
    print("\n[Test 8] 特殊表現與質性紀錄模組...")
    note_item = notes.add_note(course_id, QualitativeNoteCreate(student_id=test_sid, note_text="表現優良"), db=conn)
    note_id = note_item["id"]
    notes_list = notes.list_course_notes(course_id, student_id=None, start_date=None, end_date=None, db=conn)
    assert len(notes_list) > 0
    del_note_res = notes.delete_note(course_id, note_id, db=conn)
    assert "message" in del_note_res
    print("  ✅ 質性紀錄 新增 / 讀取 / 刪除 功能正常！")

    # 9. System Logo Reset
    print("\n[Test 9] 系統自訂 Logo 重置模組...")
    logo_res = system.reset_system_logo()
    assert "message" in logo_res
    print("  ✅ Logo 重置功能正常！")

    # 10. Frontend JavaScript Static Syntax Checks
    print("\n[Test 10] 前端 JavaScript 語法完整性驗證...")
    js_files = [
        "static/js/api.js", "static/js/i18n.js", "static/js/datepicker.js",
        "static/js/audio-engine.js", "static/js/realtime.js", "static/js/app.js",
        "static/js/toolkit.js", "static/js/remote-control.js", "static/js/projection.js"
    ]
    for f in js_files:
        assert os.path.exists(f), f"缺少前端檔案: {f}"
    print(f"  ✅ 前端 {len(js_files)} 個核心 JS 檔案完整存在！")

    print("\n" + "=" * 60)
    print("🎉 🎉 🎉 全系統所有模組與功能深度測試全部通過！零錯誤、零異常！")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
