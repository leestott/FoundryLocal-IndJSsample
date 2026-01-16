@echo off
REM Foundry Local Manufacturing Asset Intelligence - Startup Script
REM Run this script from the project root directory

echo ========================================
echo Foundry Local Asset Intelligence
echo ========================================
echo.

REM Check if Foundry Local is installed
echo Checking Foundry Local installation...
foundry --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Foundry Local not found. Please install it first:
    echo   winget install Microsoft.FoundryLocal
    pause
    exit /b 1
)
echo [OK] Foundry Local installed

REM Check if Node.js is installed
echo Checking Node.js installation...
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ first.
    pause
    exit /b 1
)
echo [OK] Node.js installed

REM Navigate to backend directory
cd /d "%~dp0backend"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend directory not found
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo.
    echo Installing npm dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
) else (
    echo [OK] Dependencies already installed
)

REM Start the backend server in a new window
echo.
echo Starting backend server...
start "Foundry Local Backend" cmd /k "node server.js"

REM Wait for server to start
echo Waiting for server to initialize...
timeout /t 6 /nobreak >nul

REM Open the web frontend via HTTP (not file://)
echo.
echo Opening web frontend...
start "" "http://localhost:3000"

echo.
echo ========================================
echo Application started successfully!
echo ========================================
echo.
echo Backend API: http://localhost:3000
echo Health check: http://localhost:3000/api/health
echo.
echo To stop: Close the server command window
echo.
pause
