# PowerShell script to start development environment

Write-Host "Starting Nowcoder Tracker Development Environment..." -ForegroundColor Green
Write-Host ""

# Start API Proxy Server
Write-Host "Starting API Proxy Server (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node proxy-server.js" -WindowStyle Normal

# Wait for API server to start
Write-Host "Waiting for API server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start Static Server
Write-Host "Starting Static Server (port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node simple-server.js" -WindowStyle Normal

Write-Host ""
Write-Host "Both servers are starting..." -ForegroundColor Green
Write-Host ""
Write-Host "API Server: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Static Server: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Domain Access: http://qsmcgogo.nowcoder.com:8000 (if configured)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit this launcher..." -ForegroundColor Yellow
Read-Host
