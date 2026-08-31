import os
import sys
import time
import re
import urllib.parse
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse

from app.database import init_db, get_db, get_bin_dir
from app.routers import courses, attendance, groups, scores, notes, reports, system, seating
from app.routers.system import require_auth, is_request_authenticated

app = FastAPI(title="國小課堂即時記錄系統", version="1.0.0")

# Generate dynamic server startup timestamp for automatic zero-friction cache busting
APP_STARTUP_TIMESTAMP = str(int(time.time()))

# HTTP Middleware: Force no-cache headers on all static files, HTML, JS, CSS
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if (path.startswith("/static") or 
        path.endswith((".html", ".js", ".css", ".json")) or 
        path in ["", "/", "/projection", "/guide", "/favicon.ico"]):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()

# Register API Routers (Protected by require_auth)
app.include_router(system.router)
app.include_router(courses.router, dependencies=[Depends(require_auth)])
app.include_router(attendance.router, dependencies=[Depends(require_auth)])
app.include_router(groups.router, dependencies=[Depends(require_auth)])
app.include_router(seating.router, dependencies=[Depends(require_auth)])
app.include_router(scores.router, dependencies=[Depends(require_auth)])
app.include_router(notes.router, dependencies=[Depends(require_auth)])
app.include_router(reports.router, dependencies=[Depends(require_auth)])

def get_bundle_dir():
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

base_dir = get_bundle_dir()

# Mount Public Static Assets (CSS, JS, Logos, Avatars needed for login)
static_dir = os.path.join(base_dir, "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

bin_dir = get_bin_dir()

# Persistent user data directories in bin/ subfolder
uploads_dir = os.path.join(bin_dir, "uploads")
os.makedirs(os.path.join(uploads_dir, "notes"), exist_ok=True)
os.makedirs(os.path.join(uploads_dir, "groups"), exist_ok=True)

photo_dir = os.path.join(bin_dir, "photo")
os.makedirs(photo_dir, exist_ok=True)

def render_cached_html(file_path: str) -> HTMLResponse:
    """Renders HTML with auto-injected timestamp query params on all JS/CSS files."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Automatically inject startup timestamp to all script and style links
        content = re.sub(r'(\.js|\.css)(\?v=[^"\'\s>]+)?', rf'\1?v={APP_STARTUP_TIMESTAMP}', content)
        return HTMLResponse(
            content=content,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    except Exception:
        return HTMLResponse(
            content="Page loading error",
            status_code=500
        )

# Secure Access for Student Photos and Note Attachments
@app.get("/photo/{filename:path}", include_in_schema=False)
def get_student_photo(filename: str, request: Request, db=Depends(get_db)):
    if not is_request_authenticated(request, db):
        raise HTTPException(status_code=401, detail="未登入無法讀取學生照片")
    file_path = os.path.join(photo_dir, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Photo not found")

@app.get("/uploads/{filepath:path}", include_in_schema=False)
def get_uploaded_file(filepath: str, request: Request, db=Depends(get_db)):
    if not is_request_authenticated(request, db):
        raise HTTPException(status_code=401, detail="未登入無法讀取系統附件")
    file_path = os.path.join(uploads_dir, filepath)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    custom_logo = os.path.join(bin_dir, "custom_logo.png")
    if os.path.exists(custom_logo):
        return FileResponse(custom_logo, media_type="image/png")
    favicon_file = os.path.join(static_dir, "logo.svg")
    if os.path.exists(favicon_file):
        return FileResponse(favicon_file, media_type="image/svg+xml")
    return {"message": "Favicon not found"}

@app.get("/")
def read_root():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return render_cached_html(index_file)
    return {"message": "Server is running, but static/index.html is missing"}

@app.get("/guide")
def read_guide(request: Request, db=Depends(get_db)):
    if not is_request_authenticated(request, db):
        redirect_target = "/guide"
        if request.url.query:
            redirect_target = f"/guide?{request.url.query}"
        return RedirectResponse(url=f"/?redirect={urllib.parse.quote(redirect_target)}", status_code=307)
    guide_file = os.path.join(static_dir, "guide.html")
    if os.path.exists(guide_file):
        return render_cached_html(guide_file)
    return {"message": "Guide page is missing"}

@app.get("/projection")
def read_projection(request: Request, db=Depends(get_db)):
    if not is_request_authenticated(request, db):
        redirect_target = "/projection"
        if request.url.query:
            redirect_target = f"/projection?{request.url.query}"
        return RedirectResponse(url=f"/?redirect={urllib.parse.quote(redirect_target)}", status_code=307)
    proj_file = os.path.join(static_dir, "projection.html")
    if os.path.exists(proj_file):
        return render_cached_html(proj_file)
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return render_cached_html(index_file)
    return {"message": "Projection page is missing"}


