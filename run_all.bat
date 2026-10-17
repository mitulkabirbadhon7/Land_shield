@echo off
title LandShield Stack Launcher
echo ===================================================
echo  Starting LandShield (Backend + Frontend)
echo ===================================================
start "LandShield Backend (Port 8000)" "%~dp0run_backend.bat"
start "LandShield Frontend (Port 3000)" "%~dp0run_frontend.bat"
echo.
echo Both servers are launching in separate windows:
echo - Backend:  http://localhost:8000 (Swagger: http://localhost:8000/docs)
echo - Frontend: http://localhost:3000
echo.
