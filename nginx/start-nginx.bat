@echo off
setlocal

REM Set the path to your Nginx installation
set NGINX_PATH="C:\tools\nginx-1.29.2"

REM Set the path to the configuration file in this project
set CONFIG_PATH="%~dp0nginx.conf"

REM Check if Nginx path exists
if not exist %NGINX_PATH%\nginx.exe (
    echo Error: Nginx executable not found at %NGINX_PATH%
    echo Please update the NGINX_PATH in this script.
    pause
    exit /b 1
)

echo Starting Nginx with project-specific configuration...
echo Nginx Path: %NGINX_PATH%
echo Config File: %CONFIG_PATH%
echo.

REM Change to Nginx directory to ensure relative paths in config (like logs) work correctly
cd /d %NGINX_PATH%

REM Start Nginx
REM We use start "" to run it in a new windowless process
start "" nginx.exe -c %CONFIG_PATH%

echo.
echo Nginx has been started in the background.
echo Use 'nginx -s stop' or 'taskkill /IM nginx.exe /F' to stop it.

pause
endlocal
