@echo off
echo Starting Stockwatch Enterprise (Web Edition)...

:: 1. Start the Backend (Host 0.0.0.0 allows mobile connections on WiFi)
start "Stockwatch Backend" cmd /k "cd /d C:\Users\hp\Desktop\Stockwatch && echo Activating Virtual Environment... && .\.venv\Scripts\activate && echo Starting FastAPI Web Server... && uvicorn api:app --reload --host 0.0.0.0 --port 8000"

:: 2. Start the Frontend (Setting --host to allow phone to connect)
start "Stockwatch Frontend" cmd /k "cd /d C:\Users\hp\Desktop\Stockwatch\frontend && echo Starting React Dev Server... && npm run dev -- --host"

:: 3. Wait 3 seconds, then open Chrome
timeout /t 3 /nobreak > nul
echo Opening Stockwatch in Chrome...
start chrome "http://localhost:5173"

echo.
echo Everything is running! 
echo Use the Browser window to manage your stock.
pause
