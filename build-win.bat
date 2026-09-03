@echo off
setlocal

echo ============================================================
echo  TeachSYS Windows 封裝
echo ============================================================

cd /d "%~dp0"

call npm install
if errorlevel 1 goto :error

call npm run build:exe:win
if errorlevel 1 goto :error

echo.
echo [OK] 封裝完成：release\win\
pause
exit /b 0

:error
echo.
echo [FAIL] 封裝失敗，請檢查上方錯誤訊息。
pause
exit /b 1
