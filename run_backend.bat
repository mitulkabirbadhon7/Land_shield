@echo off
title LandShield Backend
echo ===================================================
echo  Starting LandShield Backend Server
echo  URL: http://127.0.0.1:8000
echo  Swagger API Docs: http://127.0.0.1:8000/docs
echo ===================================================
"%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir "%~dp0backend" --reload --port 8000
pause
