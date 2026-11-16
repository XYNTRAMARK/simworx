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
 start "Project Hub local server" cmd /k "cd /d \"%~dp0\" && py -3 -m http.server 8765 --bind 127.0.0.1"
 timeout /t 2 /nobreak >nul
 start "" "http://127.0.0.1:8765/SimWorx_Project_Hub_Complete_V0.4.3.html"
 goto end
)
where python >nul 2>&1
if %errorlevel% equ 0 (
 start "Project Hub local server" cmd /k "cd /d \"%~dp0\" && python -m http.server 8765 --bind 127.0.0.1"
 timeout /t 2 /nobreak >nul
 start "" "http://127.0.0.1:8765/SimWorx_Project_Hub_Complete_V0.4.3.html"
 goto end
)
echo No Python installation detected.
echo Use a free Python 3 installation or open the HTML directly with Chrome.
echo For dependable data across releases, run at a fixed local address.
echo Always export an encrypted workspace backup.
pause
:end
endlocal
