#!/usr/bin/env python3
import sys
import os
import socket
import webbrowser
import multiprocessing
import uvicorn
import qrcode
import threading
import time
import urllib.request
from app.database import init_db

def get_base_dir() -> str:
    """Returns base directory for bundled assets or current directory."""
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.abspath(".")

def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def find_available_port(start_port=8000, max_attempts=20) -> int:
    """Finds an available TCP port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

def print_banner(port=8000):
    local_ip = get_local_ip()
    local_url = f"http://localhost:{port}"
    network_url = f"http://{local_ip}:{port}"

    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    print("=" * 60)
    print("  [*] 國小課堂即時記錄系統 (Teacher Classroom Management App)")
    print("=" * 60)
    print(f" 本機開啟網址 : {local_url}")
    print(f" 區網手機/平板 : {network_url}")
    print("-" * 60)
    print(" 請確保手機/平板與此電腦連線至相同的教室 Wi-Fi 網路！")
    print(" 掃描下方 QR Code 即可快速連線：\n")

    try:
        qr = qrcode.QRCode(version=1, border=1)
        qr.add_data(network_url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
    except Exception:
        pass
    print("=" * 60)

def open_browser_when_ready(port: int, timeout: float = 15.0):
    """Wait for server to become responsive before opening browser."""
    def check_and_open():
        start_time = time.time()
        url = f"http://127.0.0.1:{port}/"
        while time.time() - start_time < timeout:
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=0.5) as response:
                    if response.status == 200:
                        time.sleep(0.1)
                        webbrowser.open(f"http://localhost:{port}")
                        return
            except Exception:
                pass
            time.sleep(0.2)
        # Fallback if timeout reached
        webbrowser.open(f"http://localhost:{port}")

    thread = threading.Thread(target=check_and_open, daemon=True)
    thread.start()

if __name__ == "__main__":
    multiprocessing.freeze_support()
    
    from app.database import init_db, get_bin_dir
    bin_dir = get_bin_dir()
    
    # Ensure user data directories exist in bin/ subfolder
    os.makedirs(os.path.join(bin_dir, "photo"), exist_ok=True)
    os.makedirs(os.path.join(bin_dir, "uploads", "notes"), exist_ok=True)
    
    init_db()
    port = find_available_port(8000)
    print_banner(port)
    
    # Launch browser only after server is ready
    open_browser_when_ready(port)

    from app.main import app
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
