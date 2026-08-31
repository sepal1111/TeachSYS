from pydantic import BaseModel, Field
from typing import List, Optional

# --- 課程 (Courses) ---
class CourseCreate(BaseModel):
    name: str = Field(..., description="課程名稱 (如：三年一班 國語)")
    teacher_type: str = Field("homeroom", description="homeroom: 導師, subject: 科任")
    description: Optional[str] = None

class CourseUpdate(BaseModel):
    name: Optional[str] = None
    teacher_type: Optional[str] = None
    description: Optional[str] = None

# --- 學生 (Students) ---
class StudentCreate(BaseModel):
    student_number: int = Field(..., description="座號")
    name: str = Field(..., description="姓名")
    english_name: Optional[str] = Field(None, description="英文姓名")
    gender: str = Field("M", description="M: 男, F: 女")
    student_code: Optional[str] = Field(None, description="學號")
    group_id: Optional[int] = None

class StudentUpdate(BaseModel):
    student_number: Optional[int] = None
    student_code: Optional[str] = None
    name: Optional[str] = None
    english_name: Optional[str] = None
    gender: Optional[str] = None

class StudentBatchImportItem(BaseModel):
    student_number: int
    name: str
    english_name: Optional[str] = None
    gender: Optional[str] = "M"
    student_code: Optional[str] = None

class StudentBatchImportRequest(BaseModel):
    students: List[StudentBatchImportItem]

class TextImportRequest(BaseModel):
    text_content: str = Field(..., description="文字貼上內容 (如：1 小明 男\\n2 小華 女)")

# --- 分組模式與小組 (Grouping Plans & Groups) ---
class GroupPlanCreate(BaseModel):
    name: str = Field(..., description="分組模式名稱 (如：常態分組、自然實驗組)")
    copy_from_plan_id: Optional[int] = Field(None, description="若要複製既有模式結構，傳入來源 plan_id")

class GroupPlanUpdate(BaseModel):
    name: Optional[str] = Field(None, description="分組模式名稱")
    is_active: Optional[bool] = Field(None, description="是否設為當前生效模式")

class GroupingRequest(BaseModel):
    plan_id: Optional[int] = Field(None, description="指定分組模式 ID (未提供則為目前生效模式)")
    num_groups: Optional[int] = Field(None, description="預計產生的組數")
    students_per_group: Optional[int] = Field(None, description="每組學生數")
    mode: str = Field("random", description="random: 完全隨機, gender_balanced: 性別平衡隨機")

class GroupCreate(BaseModel):
    plan_id: Optional[int] = Field(None, description="所屬分組模式 ID")
    group_name: str = Field(..., description="小組名稱")
    icon_url: Optional[str] = Field(None, description="小組圖示URL或預設路徑")
    order_index: Optional[int] = Field(0, description="排序順序")

class GroupUpdate(BaseModel):
    group_name: Optional[str] = Field(None, description="小組名稱")
    icon_url: Optional[str] = Field(None, description="小組圖示URL或預設路徑")
    order_index: Optional[int] = Field(None, description="排序順序")

class GroupDragUpdate(BaseModel):
    plan_id: Optional[int] = Field(None, description="分組模式 ID")
    student_id: int
    group_id: Optional[int] = None

# --- 座位表 (Seating Chart) ---
class SeatingConfigRequest(BaseModel):
    seat_rows: int = Field(..., ge=1, le=10, description="行數 (Rows)")
    seat_cols: int = Field(..., ge=1, le=10, description="列數 (Cols)")
    blackboard_position: Optional[str] = Field("top", description="top, bottom, left, right")

class SeatingArrangeRequest(BaseModel):
    mode: str = Field("random", description="random: 完全隨機, gender_balanced: 性別平均分配")

class SeatDragUpdate(BaseModel):
    student_id: int
    target_row: int
    target_col: int

# --- 出缺席 (Attendance) ---
class AttendanceItem(BaseModel):
    student_id: int
    status: str = Field("present", description="present, sick_leave, personal_leave, official_leave, bereavement_leave, late")

class AttendanceBatchUpdate(BaseModel):
    date: str = Field(..., description="日期 YYYY-MM-DD")
    items: List[AttendanceItem]

# --- 評分 (Scoring) ---
class EvaluationRuleCreate(BaseModel):
    title: str
    category: str = Field("positive", description="positive | negative")
    score_value: int
    icon: str = "⭐"

class ScoreAddRequest(BaseModel):
    student_ids: List[int]
    rule_id: Optional[int] = None
    rule_title: str
    score: int
    category: str = Field("positive", description="positive | negative")
    date: Optional[str] = None
    plan_id: Optional[int] = Field(None, description="若為小組評分，紀錄分組模式 ID")
    group_id: Optional[int] = Field(None, description="若為小組評分，紀錄小組 ID")

# --- 質性紀錄 (Qualitative Notes) ---
class QualitativeNoteCreate(BaseModel):
    student_id: int
    note_text: str
    date: Optional[str] = None

# --- Undo (復原) ---
class UndoRequest(BaseModel):
    undo_id: int
