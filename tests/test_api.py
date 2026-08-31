import unittest
import os
import tempfile
import json
from fastapi.testclient import TestClient

# Set temp DB path for testing before importing app
db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["CLASSROOM_DB_PATH"] = db_file

from app.main import app
from app.database import init_db
from app.timezone import get_today_str_taipei, get_today_mmdd_taipei

class TestClassroomApp(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        cls.auth_token = None

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(db_file):
            os.remove(db_file)

    def test_00_unauthenticated_requests_blocked(self):
        # 1. Unauthenticated API requests must return 401
        res_courses = self.client.get("/api/courses")
        self.assertEqual(res_courses.status_code, 401)

        res_scores = self.client.post("/api/scores/1/add", json={})
        self.assertEqual(res_scores.status_code, 401)

        res_photo = self.client.get("/photo/dummy.jpg")
        self.assertEqual(res_photo.status_code, 401)

        res_upload = self.client.get("/uploads/notes/dummy.jpg")
        self.assertEqual(res_upload.status_code, 401)

        # 2. Unauthenticated page requests must redirect to /?redirect=...
        res_proj = self.client.get("/projection?course_id=1", follow_redirects=False)
        self.assertEqual(res_proj.status_code, 307)
        self.assertIn("redirect", res_proj.headers["location"])

        res_guide = self.client.get("/guide", follow_redirects=False)
        self.assertEqual(res_guide.status_code, 307)
        self.assertIn("redirect", res_guide.headers["location"])

    def test_01_system_info_and_login(self):
        # 1. Public system info
        response = self.client.get("/api/system/info")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("local_ip", data)
        self.assertIn("qr_code", data)

        # 2. Test failed login
        res_fail = self.client.post("/api/system/verify_password", json={"password": "wrongpassword"})
        self.assertEqual(res_fail.status_code, 401)

        # 3. Test successful login with AdminMMDD
        today_mmdd = get_today_mmdd_taipei()
        default_pwd = f"Admin{today_mmdd}"
        res_login = self.client.post("/api/system/verify_password", json={"password": default_pwd})
        self.assertEqual(res_login.status_code, 200)
        login_data = res_login.json()
        self.assertTrue(login_data["success"])
        self.assertIn("auth_token", login_data)
        
        token = login_data["auth_token"]
        TestClassroomApp.auth_token = token
        
        # 4. Check auth status
        res_check = self.client.get("/api/system/check_auth", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_check.status_code, 200)
        self.assertTrue(res_check.json()["authenticated"])

    def test_02_course_and_students(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create Course
        res = self.client.post("/api/courses", json={"name": "三年一班 國語", "teacher_type": "homeroom"}, headers=headers)
        self.assertEqual(res.status_code, 200)
        course_id = res.json()["id"]

        # 2. Batch import students (2 Males, 2 Females)
        students_payload = {
            "students": [
                {"student_number": 1, "name": "小明", "gender": "M"},
                {"student_number": 2, "name": "小華", "gender": "M"},
                {"student_number": 3, "name": "小美", "gender": "F"},
                {"student_number": 4, "name": "小莉", "gender": "F"}
            ]
        }
        res_batch = self.client.post(f"/api/courses/{course_id}/students/batch", json=students_payload, headers=headers)
        self.assertEqual(res_batch.status_code, 200)
        self.assertEqual(res_batch.json()["imported_count"], 4)

        # 3. List students
        res_list = self.client.get(f"/api/courses/{course_id}/students", headers=headers)
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(len(res_list.json()), 4)

    def test_03_gender_balanced_grouping(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        res = self.client.post(f"/api/groups/{course_id}/auto", json={"num_groups": 2, "mode": "gender_balanced"}, headers=headers)
        self.assertEqual(res.status_code, 200)
        groups = res.json()["groups"]
        self.assertEqual(len(groups), 2)
        
        # Verify gender balance: each group of 2 students should have 1 Male and 1 Female
        for g in groups:
            students = g["students"]
            self.assertEqual(len(students), 2)
            genders = [s["gender"] for s in students]
            self.assertIn("M", genders)
            self.assertIn("F", genders)

    def test_04_attendance_and_undo(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1
        today = get_today_str_taipei()

        # Set student 1 (id=1) as absent
        att_data = {
            "date": today,
            "items": [
                {"student_id": 1, "status": "absent"},
                {"student_id": 2, "status": "present"},
                {"student_id": 3, "status": "present"},
                {"student_id": 4, "status": "present"}
            ]
        }
        res = self.client.post(f"/api/attendance/{course_id}", json=att_data, headers=headers)
        self.assertEqual(res.status_code, 200)
        undo_id = res.json()["undo_id"]

        # Check attendance list
        res_get = self.client.get(f"/api/attendance/{course_id}?date={today}", headers=headers)
        records = res_get.json()["records"]
        s1 = next(r for r in records if r["student_id"] == 1)
        self.assertEqual(s1["status"], "absent")

        # Test Undo
        res_undo = self.client.post("/api/scores/undo", json={"undo_id": undo_id}, headers=headers)
        self.assertEqual(res_undo.status_code, 200)

    def test_05_scoring_and_undo(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1
        today = get_today_str_taipei()

        # Add 1 point for student 2 and 3
        score_data = {
            "student_ids": [2, 3],
            "rule_title": "發言踴躍",
            "score": 1,
            "category": "positive",
            "date": today
        }
        res = self.client.post(f"/api/scores/{course_id}/add", json=score_data, headers=headers)
        self.assertEqual(res.status_code, 200)
        undo_id = res.json()["undo_id"]

        # Verify score total in dashboard
        res_dash = self.client.get(f"/api/reports/{course_id}/dashboard?period=today", headers=headers)
        students = res_dash.json()["students"]
        s2 = next(s for s in students if s["id"] == 2)
        self.assertEqual(s2["score"], 1)

        # Test Undo
        res_undo = self.client.post("/api/scores/undo", json={"undo_id": undo_id}, headers=headers)
        self.assertEqual(res_undo.status_code, 200)

        # Re-verify score is zero after undo
        res_dash2 = self.client.get(f"/api/reports/{course_id}/dashboard?period=today", headers=headers)
        s2_after = next(s for s in res_dash2.json()["students"] if s["id"] == 2)
        self.assertEqual(s2_after["score"], 0)

    def test_06_excel_export(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1
        res = self.client.get(f"/api/reports/{course_id}/export", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    def test_07_seating_chart(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        # 1. Update config
        res_cfg = self.client.post(f"/api/seating/{course_id}/config", json={"seat_rows": 4, "seat_cols": 5}, headers=headers)
        self.assertEqual(res_cfg.status_code, 200)

        # 2. Auto arrange (gender_balanced)
        res_auto = self.client.post(f"/api/seating/{course_id}/auto", json={"mode": "gender_balanced"}, headers=headers)
        self.assertEqual(res_auto.status_code, 200)
        grid = res_auto.json()["grid"]
        self.assertEqual(len(grid), 4)
        self.assertEqual(len(grid[0]), 5)

        # 3. Test drag & drop seat move / swap
        res_drag = self.client.put(f"/api/seating/{course_id}/drag", json={
            "student_id": 1,
            "target_row": 4,
            "target_col": 5
        }, headers=headers)
        self.assertEqual(res_drag.status_code, 200)

    def test_08_grouping_per_group_size(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        # Group 4 students with 2 per group -> 2 groups
        res = self.client.post(f"/api/groups/{course_id}/auto", json={"students_per_group": 2, "mode": "random"}, headers=headers)
        self.assertEqual(res.status_code, 200)
        groups = res.json()["groups"]
        self.assertEqual(len(groups), 2)

    def test_09_text_import(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        text_data = "5 王小明 男\n6 李小華 女"
        res = self.client.post(f"/api/courses/{course_id}/students/text_import", json={"text_content": text_data}, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["imported_count"], 2)

    def test_10_dashboard_periods(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        for p in ["today", "week", "month", "semester"]:
            res = self.client.get(f"/api/reports/{course_id}/dashboard?period={p}", headers=headers)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("individual_leaderboard", data)
            self.assertIn("group_leaderboard", data)

    def test_11_rule_crud(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        # 1. Create custom rule
        res_create = self.client.post(f"/api/scores/{course_id}/rules", json={
            "title": "熱情回答",
            "score_value": 3,
            "category": "positive",
            "icon": "🎉"
        }, headers=headers)
        self.assertEqual(res_create.status_code, 200)
        rule_id = res_create.json()["id"]

        # 2. Update custom rule
        res_update = self.client.put(f"/api/scores/{course_id}/rules/{rule_id}", json={
            "title": "熱情回答超讚",
            "score_value": 5,
            "category": "positive",
            "icon": "🔥"
        }, headers=headers)
        self.assertEqual(res_update.status_code, 200)

        # 3. Reset defaults
        res_reset = self.client.post(f"/api/scores/{course_id}/rules/reset_defaults", headers=headers)
        self.assertEqual(res_reset.status_code, 200)

    def test_12_note_media_upload(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        # Fetch student list
        students = self.client.get(f"/api/courses/{course_id}/students", headers=headers).json()
        student_id = students[0]["id"]

        dummy_content = b"fake image content"
        files = {"media_file": ("test_pic.jpg", dummy_content, "image/jpeg")}
        data = {
            "student_id": str(student_id),
            "note_text": "課堂畫畫作品",
            "date_str": get_today_str_taipei()
        }

        res = self.client.post(f"/api/notes/{course_id}/with_media", data=data, files=files, headers=headers)
        self.assertEqual(res.status_code, 200)
        res_data = res.json()
        self.assertIn("media_url", res_data)
        self.assertTrue(res_data["media_url"].startswith("/uploads/notes/"))

    def test_13_blackboard_position_config(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        # Update blackboard position to 'bottom'
        res_update = self.client.post(f"/api/seating/{course_id}/config", json={
            "seat_rows": 5,
            "seat_cols": 6,
            "blackboard_position": "bottom"
        }, headers=headers)
        self.assertEqual(res_update.status_code, 200)

        # Get seating chart data and verify blackboard_position == 'bottom'
        res_get = self.client.get(f"/api/seating/{course_id}", headers=headers)
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.json()["blackboard_position"], "bottom")

    def test_14_arrange_seats_by_number(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        res = self.client.post(f"/api/seating/{course_id}/auto", json={"mode": "by_number"}, headers=headers)
        self.assertEqual(res.status_code, 200)
        grid = res.json()["grid"]
        first_seat_student = grid[0][0]["student"]
        self.assertIsNotNone(first_seat_student)
        self.assertEqual(first_seat_student["student_number"], 1)

    def test_15_student_code_import(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        text_data = "10 112010 張美美 女"
        res = self.client.post(f"/api/courses/{course_id}/students/text_import", json={"text_content": text_data}, headers=headers)
        self.assertEqual(res.status_code, 200)
        
        students = self.client.get(f"/api/courses/{course_id}/students", headers=headers).json()
        target = next((s for s in students if s["student_number"] == 10), None)
        self.assertIsNotNone(target)
        self.assertEqual(target["student_code"], "112010")

    def test_16_student_update_api(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        students = self.client.get(f"/api/courses/{course_id}/students", headers=headers).json()
        student_id = students[0]["id"]

        res_update = self.client.put(f"/api/courses/{course_id}/students/{student_id}", json={
            "student_number": 1,
            "student_code": "112999",
            "name": "王大明改",
            "gender": "M"
        }, headers=headers)
        self.assertEqual(res_update.status_code, 200)

        updated_students = self.client.get(f"/api/courses/{course_id}/students", headers=headers).json()
        target = next((s for s in updated_students if s["id"] == student_id), None)
        self.assertEqual(target["name"], "王大明改")
        self.assertEqual(target["student_code"], "112999")

    def test_17_system_password_auth_and_reset(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        mmdd = get_today_mmdd_taipei()
        default_pwd = f"Admin{mmdd}"
        
        # Test update password prefix to 'math'
        res_update = self.client.post("/api/system/update_password_prefix", json={
            "current_password": default_pwd,
            "new_prefix": "math"
        }, headers=headers)
        self.assertEqual(res_update.status_code, 200)

        # Verify with new password: math + MMDD
        res_verify_new = self.client.post("/api/system/verify_password", json={"password": f"math{mmdd}"})
        self.assertEqual(res_verify_new.status_code, 200)

        # Test emergency reset
        res_reset = self.client.post("/api/system/reset_password_prefix")
        self.assertEqual(res_reset.status_code, 200)

        # Verify default password works again
        res_verify_default_again = self.client.post("/api/system/verify_password", json={"password": default_pwd})
        self.assertEqual(res_verify_default_again.status_code, 200)
        TestClassroomApp.auth_token = res_verify_default_again.json()["auth_token"]

    def test_18_student_score_logs(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1
        today = get_today_str_taipei()

        score_data = {
            "student_ids": [2],
            "rule_title": "作業優良",
            "score": 2,
            "category": "positive",
            "date": today
        }
        res_add = self.client.post(f"/api/scores/{course_id}/add", json=score_data, headers=headers)
        self.assertEqual(res_add.status_code, 200)

        res_logs = self.client.get(f"/api/scores/{course_id}/student/2/logs", headers=headers)
        self.assertEqual(res_logs.status_code, 200)
        data = res_logs.json()
        self.assertIn("logs", data)
        self.assertTrue(len(data["logs"]) > 0)
        latest_log = data["logs"][0]
        self.assertEqual(latest_log["rule_title"], "作業優良")

        res_del = self.client.delete(f"/api/scores/{course_id}/logs/{latest_log['id']}", headers=headers)
        self.assertEqual(res_del.status_code, 200)

    def test_20_student_english_name_and_templates(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}
        course_id = 1

        # 1. Add single student with english_name
        student_data = {
            "student_number": 10,
            "student_code": "112010",
            "name": "陳大衛",
            "english_name": "David Chen",
            "gender": "M"
        }
        res_create = self.client.post(f"/api/courses/{course_id}/students", json=student_data, headers=headers)
        self.assertEqual(res_create.status_code, 200)
        s_id = res_create.json()["id"]

        # 2. Update student english_name
        res_update = self.client.put(f"/api/courses/{course_id}/students/{s_id}", json={
            "student_number": 10,
            "student_code": "112010",
            "name": "陳大衛",
            "english_name": "David C.",
            "gender": "M"
        }, headers=headers)
        self.assertEqual(res_update.status_code, 200)

        # 3. Check student list returns english_name
        res_list = self.client.get(f"/api/courses/{course_id}/students", headers=headers)
        self.assertEqual(res_list.status_code, 200)
        students = res_list.json()
        target = next((s for s in students if s["id"] == s_id), None)
        self.assertIsNotNone(target)
        self.assertEqual(target["english_name"], "David C.")

        # 4. Batch import with english_name
        batch_payload = {
            "students": [
                {"student_number": 11, "name": "林小艾", "english_name": "Emily Lin", "gender": "F"},
                {"student_number": 12, "name": "張麥克", "english_name": "Michael Chang", "gender": "M"}
            ]
        }
        res_batch = self.client.post(f"/api/courses/{course_id}/students/batch", json=batch_payload, headers=headers)
        self.assertEqual(res_batch.status_code, 200)
        self.assertEqual(res_batch.json()["imported_count"], 2)

        # 5. Text import with english_name
        text_payload = {
            "text_content": "13 112013 趙約翰 John M\n14 112014 錢露西 Lucy F"
        }
        res_text = self.client.post(f"/api/courses/{course_id}/students/text_import", json=text_payload, headers=headers)
        self.assertEqual(res_text.status_code, 200)
        self.assertEqual(res_text.json()["imported_count"], 2)

        # 6. Verify dashboard returns english_name
        res_dash = self.client.get(f"/api/reports/{course_id}/dashboard?period=today", headers=headers)
        self.assertEqual(res_dash.status_code, 200)
        dash_students = res_dash.json()["students"]
        dash_emily = next((s for s in dash_students if s["student_number"] == 11), None)
        self.assertIsNotNone(dash_emily)
        self.assertEqual(dash_emily["english_name"], "Emily Lin")

        # 7. Check template downloads
        res_tpl_xlsx = self.client.get("/api/courses/template/students_excel", headers=headers)
        self.assertEqual(res_tpl_xlsx.status_code, 200)
        self.assertIn("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", res_tpl_xlsx.headers["content-type"])

        res_tpl_csv = self.client.get("/api/courses/template/students_csv", headers=headers)
        self.assertEqual(res_tpl_csv.status_code, 200)
        self.assertIn("text/csv", res_tpl_csv.headers["content-type"])

    def test_21_logout_session(self):
        token = TestClassroomApp.auth_token
        headers = {"Authorization": f"Bearer {token}"}

        # Verify authenticated before logout
        res_before = self.client.get("/api/courses", headers=headers)
        self.assertEqual(res_before.status_code, 200)

        # Logout
        res_logout = self.client.post("/api/system/logout", headers=headers)
        self.assertEqual(res_logout.status_code, 200)

        # Verify token is now rejected with 401
        res_after = self.client.get("/api/courses", headers=headers)
        self.assertEqual(res_after.status_code, 401)

if __name__ == "__main__":
    unittest.main()


