# Foundry Local Manufacturing Asset Intelligence - Startup Script
# Run this script from the project root directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Foundry Local Asset Intelligence" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Foundry Local is installed
Write-Host "Checking Foundry Local installation..." -ForegroundColor Yellow
$foundryCheck = Get-Command foundry -ErrorAction SilentlyContinue
if ($foundryCheck) {
    $foundryVersion = foundry --version 2>&1
    Write-Host "[OK] Foundry Local installed: $foundryVersion" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] Foundry Local not found. Please install it first:" -ForegroundColor Red
    Write-Host "  winget install Microsoft.FoundryLocal" -ForegroundColor White
    exit 1
}

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    $nodeVersion = node --version 2>&1
    Write-Host "[OK] Node.js installed: $nodeVersion" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Navigate to backend directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"
$webDir = Join-Path $scriptDir "web"

if (-not (Test-Path $backendDir)) {
    Write-Host "[ERROR] Backend directory not found at: $backendDir" -ForegroundColor Red
    exit 1
}

Set-Location $backendDir

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
}
else {
    Write-Host "[OK] Dependencies already installed" -ForegroundColor Green
}

# Start the backend server in a new window
Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Yellow
$cmd = "Set-Location '$backendDir'; Write-Host 'Foundry Local Backend Server' -ForegroundColor Cyan; node server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd

# Wait for server to start
Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

Write-Host "[OK] Backend server started at http://localhost:3000" -ForegroundColor Green

# Open the web frontend via HTTP (not file://)
Write-Host ""
Write-Host "Opening web frontend..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"
Write-Host "[OK] Web frontend opened in browser" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application started successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend API: http://localhost:3000" -ForegroundColor White
Write-Host "Health check: http://localhost:3000/api/health" -ForegroundColor White
Write-Host ""
Write-Host "To stop: Close the server PowerShell window" -ForegroundColor Gray
