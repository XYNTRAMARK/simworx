@echo off
setlocal
cd /d "%~dp0"
echo.
echo SIM-WORX PROJECT HUB V0.4.3 - PRIVATE LOCAL WORKSPACE
echo.
echo This runs ONLY on your PC (127.0.0.1:8765).
echo Close other Project Hub local servers first.
echo Keep using the same Chrome profile and this same local address
echo when upgrading versions so the encrypted browser database stays accessible.
echo.
where py >nul 2>&1
if %errorlevel% equ 0 (
 start "" "http://127.0.0.1:8765/SimWorx_Project_Hub_Complete_V0.4.3.html"
 py -3 -m http.server 8765 --bind 127.0.0.1
 goto end
)
where python >nul 2>&1
if %errorlevel% equ 0 (
 start "" "http://127.0.0.1:8765/SimWorx_Project_Hub_Complete_V0.4.3.html"
 python -m http.server 8765 --bind 127.0.0.1
 goto end
)
echo No Python installation detected.
echo Install free Python 3, or open the included HTML in Chrome directly.
echo File-based browser storage may not persist across different versions or directories.
echo To protect work, export an encrypted backup in Project Hub settings.
pause
:end
endlocal
