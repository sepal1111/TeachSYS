#!/usr/bin/env python3
"""
PyInstaller Packaging Script for Windows / macOS single executable bundle.
Run this script to compile the portable local server into a standalone binary.
"""

import PyInstaller.__main__
import os
import sys
import platform

def build():
    print("[*] Starting PyInstaller Build Process...")
    
    current_os = platform.system()
    path_sep = ";" if current_os == "Windows" else ":"
    
    # Path to entry script
    entry_script = os.path.abspath("run_server.py")
    
    # Additional data files (static assets)
    static_folder = os.path.abspath("static")
    
    args = [
        entry_script,
        '--onefile',
        '--name=ClassroomManagerServer',
        f'--add-data={static_folder}{path_sep}static',
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
    
    PyInstaller.__main__.run(args)
    print("[OK] PyInstaller Build Completed successfully! Binary generated in dist/")

if __name__ == "__main__":
    build()
