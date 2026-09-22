@echo off
rem ------------------------------------------------------------
rem Simple one‑click launcher for the One‑UI‑Trader static site
rem ------------------------------------------------------------

rem ----- Verify that Python is on the PATH -------------------
where python >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Python is not found in your PATH.
    echo Install Python (https://www.python.org/downloads/windows/)
    echo and check “Add Python to PATH” during installation.
    pause
    exit /b 1
)

rem ----- Choose a free port (default 8000) --------------------
set PORT=8080

rem ----- Start Python’s built‑in HTTP server -----------------
rem The server runs in the background; we capture its PID so we can
rem close it automatically when the console window is closed.
start "" cmd /c "python -m http.server %PORT% ^&^& echo Server stopped & pause"
rem Give the server a second to spin up
ping -n 2 127.0.0.1 >nul

rem ----- Open the UI in the default browser ------------------
start "" http://localhost:%PORT%/index.html

rem ----- Keep the console open so you can stop the server ----
echo.
echo ---------------------------------------------------------
echo Server running at http://localhost:%PORT%/index.html
echo Press Ctrl+C to terminate the server, or close this window.
echo ---------------------------------------------------------
rem Wait indefinitely (Ctrl+C will break out)
:stay
timeout /t 86400 >nul
goto stay
