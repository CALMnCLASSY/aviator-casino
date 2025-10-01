@echo off
echo ========================================
echo ClassyBet Backend Setup and Test Script
echo ========================================

echo.
echo Step 1: Navigating to backend directory...
cd /d "%~dp0classybet-backend"

echo.
echo Step 2: Installing dependencies...
call npm install

echo.
echo Step 3: Checking if .env file exists...
if exist .env (
    echo ✅ .env file found
) else (
    echo ⚠️ .env file not found - copying from .env.example
    copy .env.example .env
    echo Please edit .env file with your MongoDB URI and settings
    pause
)

echo.
echo Step 4: Testing basic Node.js functionality...
node -e "console.log('Node.js is working:', process.version)"

echo.
echo Step 5: Starting the backend server...
echo ========================================
echo Server will start at http://localhost:3001
echo Admin panel: http://localhost:3001/admin  
echo Profile page: http://localhost:3001/profile
echo ========================================
echo.

call npm start

pause