@echo off
echo ========================================
echo ClassyBet Frontend Server
echo ========================================

echo.
echo Starting ClassyBet frontend server...
echo Game will be available at: http://localhost:8080
echo Make sure the backend server is running on port 3001
echo.

cd /d "%~dp0classybet"

echo Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Node.js found
    
    if not exist node_modules (
        echo 📦 Installing frontend dependencies...
        npm install
    )
    
    echo 🚀 Starting Express frontend server...
    npm start
) else (
    echo ❌ Node.js not found
    echo Please install Node.js to run the frontend server
    echo.
    echo Alternative: You can also access the game at:
    echo Backend Admin: http://localhost:3001/admin
    echo Backend Profile: http://localhost:3001/profile
    echo.
    pause
)

pause