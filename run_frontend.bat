@echo off
title LandShield Frontend
echo ===================================================
echo  Starting LandShield Next.js Frontend Server
echo  URL: http://localhost:3000
echo ===================================================
cd /d "%~dp0frontend"
call npm run dev
pause
