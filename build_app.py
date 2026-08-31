#!/usr/bin/env python3
"""
國小課堂即時記錄系統 - 跨平台執行檔自動化封裝工具 (build_app.py)
支援建置 Windows (.exe) 與 macOS (.app / 可執行檔)

用法：
  python3 build_app.py
"""

import sys
import os
import platform

def build():
    print("=" * 65)
    print("[*] 正在啟動《國小課堂即時記錄系統》跨平台執行檔封裝程序...")
    print("=" * 65)
    
    current_os = platform.system()
    print(f"[*] 當前建置作業系統環境 : {current_os} ({platform.machine()})")
    
    try:
        import PyInstaller.__main__
    except ImportError:
        print("[!] 錯誤：未安裝 PyInstaller！請先執行 `pip install pyinstaller` 再重試。")
        sys.exit(1)

    # 進入點與資源目錄解析
    entry_script = os.path.abspath("run_server.py")
    static_folder = os.path.abspath("static")
    
    # 判斷 PyInstaller 跨平台資料分隔符號 (Windows 為 ';'，macOS / Linux 為 ':')
    path_sep = ";" if current_os == "Windows" else ":"
    data_arg = f"{static_folder}{path_sep}static"
    
    output_name = "ClassroomManager"
    
    args = [
        entry_script,
        '--onefile',
        f'--name={output_name}',
        f'--add-data={data_arg}',
        '--collect-all=uvicorn',
        '--collect-all=fastapi',
        '--collect-all=starlette',
        '--collect-all=multipart',
        '--hidden-import=app',
        '--hidden-import=app.main',
        '--hidden-import=app.database',
        '--hidden-import=app.models',
        '--hidden-import=app.routers',
        '--hidden-import=app.routers.courses',
        '--hidden-import=app.routers.attendance',
        '--hidden-import=app.routers.groups',
        '--hidden-import=app.routers.seating',
        '--hidden-import=app.routers.scores',
        '--hidden-import=app.routers.notes',
        '--hidden-import=app.routers.reports',
        '--hidden-import=app.routers.system',
        '--hidden-import=openpyxl',
        '--hidden-import=pandas',
        '--hidden-import=qrcode',
        '--hidden-import=PIL',
        '--hidden-import=sqlite3',
        '--hidden-import=pydantic',
        '--hidden-import=multipart',
        '--hidden-import=python_multipart',
        '--clean'
    ]
    
    print(f"[*] PyInstaller 參數配置完成：{args}")
    print("[*] 正在進行編譯與靜態資源壓裝，請稍候...")
    
    try:
        PyInstaller.__main__.run(args)
        print("=" * 65)
        print("[OK] 執行檔封裝成功！打包檔已生成於 `dist/` 目錄中：")
        dist_dir = os.path.abspath("dist")
        if current_os == "Windows":
            print(f"   -> Windows 可執行檔 : {os.path.join(dist_dir, output_name + '.exe')}")
        else:
            print(f"   -> macOS / Linux 可執行檔 : {os.path.join(dist_dir, output_name)}")
        print("=" * 65)
    except Exception as e:
        print(f"[!] 打包建置過程發生例外狀況：{e}")
        sys.exit(1)

if __name__ == "__main__":
    build()
