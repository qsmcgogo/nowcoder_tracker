@echo off
echo Starting Nowcoder Tracker Development Environment...
echo.

echo Starting API Proxy Server (port 3000)...
start "API Server" cmd /k "node proxy-server.js"

echo Waiting for API server to start...
timeout /t 3 /nobreak >nul

echo Starting Static Server (port 8000)...
start "Static Server" cmd /k "node simple-server.js"

echo.
echo Both servers are starting...
echo.
echo API Server: http://localhost:3000
echo Static Server: http://localhost:8000
echo Domain Access: http://qsmcgogo.nowcoder.com:8000 (if configured)
echo.
echo Press any key to exit this launcher...
pause >nul
