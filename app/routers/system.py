import socket
import qrcode
import io
import base64
import json
import os
import sys
import secrets
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlite3 import Connection
from app.database import get_db, get_bin_dir
from app.timezone import get_today_taipei, get_today_str_taipei, get_today_mmdd_taipei
from app.ws_manager import manager

router = APIRouter(prefix="/api/system", tags=["System"])


# --- Session & Security Helpers ---

def create_session(db: Connection) -> str:
    """Generates a secure random session token and stores it in SQLite."""
    token = secrets.token_urlsafe(32)
    today_str = get_today_str_taipei()
    expires_at = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
    
    cursor = db.cursor()
    # Clean up expired sessions
    try:
        cursor.execute("DELETE FROM system_sessions WHERE expires_at < CURRENT_TIMESTAMP OR created_date != ?", (today_str,))
    except Exception:
        pass
    
    cursor.execute("""
        INSERT INTO system_sessions (token, created_date, expires_at)
        VALUES (?, ?, ?)
    """, (token, today_str, expires_at))
    db.commit()
    return token

def validate_session_token(token: Optional[str], db: Connection) -> bool:
    """Validates if token exists in system_sessions, matches today's date, and hasn't expired."""
    if not token:
        return False
    cursor = db.cursor()
    today_str = get_today_str_taipei()
    cursor.execute("""
        SELECT token FROM system_sessions 
        WHERE token = ? AND created_date = ? AND expires_at >= CURRENT_TIMESTAMP
    """, (token, today_str))
    row = cursor.fetchone()
    return row is not None

def get_current_session_token(request: Request) -> Optional[str]:
    """Extracts session token from Authorization Header, X-Auth-Token Header, or auth_session Cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    
    x_token = request.headers.get("X-Auth-Token")
    if x_token:
        return x_token.strip()
    
    cookie_token = request.cookies.get("auth_session")
    if cookie_token:
        return cookie_token.strip()
    
    return None

def is_request_authenticated(request: Request, db: Connection) -> bool:
    token = get_current_session_token(request)
    return validate_session_token(token, db)

def require_auth(request: Request, db: Connection = Depends(get_db)) -> str:
    """FastAPI dependency to strictly require authentication for protected endpoints."""
    token = get_current_session_token(request)
    if not validate_session_token(token, db):
        raise HTTPException(status_code=401, detail="未登入或身分驗證已逾期，請先登入系統！")
    return token


# --- Real-time Push (WebSocket) ---

@router.websocket("/ws/{course_id}")
async def course_realtime_feed(websocket: WebSocket, course_id: int, token: Optional[str] = None, db: Connection = Depends(get_db)):
    """Pushes an event to every connected client whenever this course's scores,
    attendance or groups change, so score/leaderboard displays (e.g. the
    projection screen) update instantly without client-side polling."""
    session_token = token or websocket.cookies.get("auth_session")
    if not validate_session_token(session_token, db):
        await websocket.close(code=4401)
        return

    await manager.connect(course_id, websocket)
    try:
        while True:
            # Most clients never send anything and this just detects disconnects.
            # A phone acting as a toolkit remote control sends
            # {"type": "toolkit_action", "action": ..., "payload": ...}, which
            # is relayed as-is to every other connected client on this course
            # (e.g. the projection screen), with no server-side persistence.
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            if isinstance(data, dict) and data.get("type") == "toolkit_action" and data.get("action"):
                await manager.relay(course_id, {
                    "event": "toolkit_action",
                    "action": data["action"],
                    "payload": data.get("payload"),
                }, websocket)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(course_id, websocket)


# --- Network & System Info ---

def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Try to connect to an external dummy IP to get local LAN IP
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

@router.get("/info")
def get_system_info(port: int = 8000, course_id: int = None, mode: str = "mobile"):
    local_ip = get_local_ip()
    base_url = f"http://{local_ip}:{port}"
    
    # Generate mobile direct scoring URL if course_id is provided or mode=mobile
    if course_id:
        mobile_url = f"{base_url}/?mobile=1&course_id={course_id}"
    else:
        mobile_url = f"{base_url}/?mobile=1"

    target_url = mobile_url if mode == "mobile" else base_url
    
    # Generate QR Code Base64
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=8,
        border=2,
    )
    qr.add_data(target_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, "PNG")
    qr_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    return {
        "local_ip": local_ip,
        "port": port,
        "url": target_url,
        "base_url": base_url,
        "mobile_url": mobile_url,
        "qr_code": f"data:image/png;base64,{qr_b64}"
    }


# --- Password & Auth Endpoints ---

class PasswordVerifyRequest(BaseModel):
    password: str = Field(..., description="輸入的驗證密碼")

class PasswordUpdateRequest(BaseModel):
    current_password: str = Field(..., description="目前密碼")
    new_prefix: str = Field(..., description="新的密碼字頭（至少4碼）")

def get_password_prefix(db: Connection) -> str:
    cursor = db.cursor()
    cursor.execute("SELECT value FROM system_settings WHERE key = 'password_prefix'")
    row = cursor.fetchone()
    if row and row["value"]:
        return row["value"]
    return "Admin"

@router.get("/auth_info")
def get_auth_info(request: Request, db: Connection = Depends(get_db)):
    today_str = get_today_str_taipei()
    mmdd = get_today_mmdd_taipei()
    authenticated = is_request_authenticated(request, db)
    return {
        "today_str": today_str,
        "today_mmdd": mmdd,
        "default_prefix": "Admin",
        "authenticated": authenticated
    }

@router.get("/check_auth")
def check_auth(request: Request, db: Connection = Depends(get_db)):
    authenticated = is_request_authenticated(request, db)
    return {
        "authenticated": authenticated,
        "today_str": get_today_str_taipei()
    }

@router.post("/verify_password")
def verify_password(data: PasswordVerifyRequest, response: Response, db: Connection = Depends(get_db)):
    prefix = get_password_prefix(db)
    today_mmdd = get_today_mmdd_taipei()
    expected_password = f"{prefix}{today_mmdd}"
    
    if data.password.strip() == expected_password:
        token = create_session(db)
        today_str = get_today_str_taipei()
        
        # Set HttpOnly Session Cookie (valid for 1 day)
        response.set_cookie(
            key="auth_session",
            value=token,
            max_age=86400,
            path="/",
            samesite="lax",
            httponly=False  # Allow JS readability for verification checks if needed
        )
        
        return {
            "success": True,
            "message": "身分驗證成功！",
            "auth_token": token,
            "auth_date": today_str
        }
    else:
        raise HTTPException(status_code=401, detail=f"密碼錯誤！密碼公式為：[字頭] + [當天月日{today_mmdd}]")

@router.post("/logout")
def logout_session(request: Request, response: Response, db: Connection = Depends(get_db)):
    token = get_current_session_token(request)
    if token:
        cursor = db.cursor()
        cursor.execute("DELETE FROM system_sessions WHERE token = ?", (token,))
        db.commit()
    
    response.delete_cookie(key="auth_session", path="/")
    return {
        "success": True,
        "message": "已成功登出系統！"
    }

@router.post("/update_password_prefix")
def update_password_prefix(data: PasswordUpdateRequest, db: Connection = Depends(get_db), auth: str = Depends(require_auth)):
    prefix = get_password_prefix(db)
    today_mmdd = get_today_mmdd_taipei()
    expected_password = f"{prefix}{today_mmdd}"
    
    if data.current_password.strip() != expected_password:
        raise HTTPException(status_code=401, detail="目前密碼驗證失敗！")
    
    new_prefix = data.new_prefix.strip()
    if len(new_prefix) < 4:
        raise HTTPException(status_code=400, detail="密碼字頭長度至少必須為 4 碼！")
    
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO system_settings (key, value) VALUES ('password_prefix', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    """, (new_prefix,))
    db.commit()
    
    return {
        "success": True,
        "message": f"密碼字頭已成功修改為『{new_prefix}』！今日最新密碼為：{new_prefix}{today_mmdd}"
    }

@router.post("/reset_password_prefix")
def reset_password_prefix(db: Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO system_settings (key, value) VALUES ('password_prefix', 'Admin')
        ON CONFLICT(key) DO UPDATE SET value = 'Admin'
    """, ())
    db.commit()
    today_mmdd = get_today_mmdd_taipei()
    return {
        "success": True,
        "message": f"密碼字頭已成功恢復為預設『Admin』！今日密碼為：Admin{today_mmdd}"
    }


# --- Logo & Favicon 自訂替換支援 ---

def get_bundle_dir():
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_custom_logo_path():
    return os.path.join(get_bin_dir(), "custom_logo.png")

def get_default_logo_path():
    return os.path.join(get_bundle_dir(), "static", "logo.svg")

@router.get("/logo", include_in_schema=False)
def get_system_logo():
    custom = get_custom_logo_path()
    if os.path.exists(custom):
        return FileResponse(custom, media_type="image/png")
    default_svg = get_default_logo_path()
    if os.path.exists(default_svg):
        return FileResponse(default_svg, media_type="image/svg+xml")
    return {"message": "Logo not found"}

@router.post("/logo")
async def upload_system_logo(file: UploadFile = File(...), auth: str = Depends(require_auth)):
    filename = file.filename.lower()
    if not (filename.endswith(".png") or filename.endswith(".jpg") or filename.endswith(".jpeg") or filename.endswith(".svg") or filename.endswith(".webp")):
        raise HTTPException(status_code=400, detail="請上傳 PNG、JPG 或 SVG 圖片檔案！")
    
    contents = await file.read()
    custom_path = get_custom_logo_path()
    with open(custom_path, "wb") as f:
        f.write(contents)
    
    return {"success": True, "message": "Logo 與 Favicon 已成功替換！"}

@router.post("/logo/reset")
def reset_system_logo(auth: str = Depends(require_auth)):
    custom_path = get_custom_logo_path()
    if os.path.exists(custom_path):
        try:
            os.remove(custom_path)
        except Exception:
            pass
    return {"success": True, "message": "已成功恢復為系統預設 Logo！"}

@router.get("/bgm_list")
def get_bgm_list():
    base_dir = get_bundle_dir() if "get_bundle_dir" in globals() else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    music_dir = os.path.join(base_dir, "static", "music")
    music_list = []
    if os.path.exists(music_dir):
        for f in sorted(os.listdir(music_dir)):
            ext = os.path.splitext(f)[1].lower()
            if ext in [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]:
                name_without_ext = os.path.splitext(f)[0]
                music_list.append({
                    "title": name_without_ext,
                    "filename": f,
                    "url": f"/static/music/{f}"
                })
    return {"music": music_list}


